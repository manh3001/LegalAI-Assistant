const { pool, poolConnect } = require('../config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { chunkText } = require('../utils/chunkingUtils');

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'legai-index';
let genAI;
let embedModel;
let pineconeClient;
let pineconeIndex;

const initCloudServices = () => {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    }
    if (!pineconeClient) {
        pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        pineconeIndex = pineconeClient.index(PINECONE_INDEX_NAME);
    }
};

const updateSyncStatus = async (documentId, ssmsStatus, pineconeStatus) => {
    await poolConnect;
    return pool.request()
        .input('id', documentId)
        .input('ssms', ssmsStatus)
        .input('pinecone', pineconeStatus)
        .query(`
            UPDATE LegalDocuments
            SET SyncStatusSsms = @ssms,
                SyncStatusPinecone = @pinecone
            WHERE Id = @id
        `);
};
const upsertLegalData = async (data, isUpdate = false) => {
    await poolConnect;
    initCloudServices();

    let documentId;
    let ssmsStatus = 'syncing';
    let pineconeStatus = 'syncing';



    try {
        let finalContent = data.content;
        let shouldReVectorize = true;

        // 1. TẠO ID NHẤT QUÁN: Ưu tiên Số hiệu văn bản -> Nếu không có mới dùng Tiêu đề
        // Ưu tiên Số hiệu văn bản làm ID để khớp với dữ liệu Crawl
        const idSource = (data.documentNumber && data.documentNumber.trim() !== '')
            ? data.documentNumber
            : data.title;
        documentId = convertLegalStringToSlug(idSource);

        // 2. CHECK TỒN TẠI & XỬ LÝ THEO PHƯƠNG ÁN B (Vá lỗi đồng bộ)
        if (!isUpdate) {
            const checkStatus = await pool.request()
                .input('id', documentId)
                .query('SELECT SyncStatusSsms, SyncStatusPinecone, Content FROM LegalDocuments WHERE Id = @id');

            const existingDoc = checkStatus.recordset[0];

            if (existingDoc) {
                if (existingDoc.SyncStatusPinecone === 'success') {
                    return {
                        success: false,
                        error: 'DUPLICATE_DOCUMENT',
                        message: 'Văn bản đã tồn tại và đã được vector hóa thành công.'
                    };
                } else {
                    // Nếu đã có trong SQL nhưng Pinecone lỗi: Ép sang chế độ Update để vá lỗi
                    console.log(`[legalDataService] Phát hiện lỗi đồng bộ cho ID: ${documentId}. Tự động chuyển sang Retry Sync.`);
                    isUpdate = true;
                    data.id = documentId; // Đảm bảo có ID để chạy query Update bên dưới
                }
            }
        }

        if (isUpdate) {
            // Dùng ID từ dữ liệu cũ hoặc ID vừa sinh ra ở trên
            documentId = data.id || documentId;

            // LẤY DATA CŨ ĐỂ SO SÁNH
            const oldDocResult = await pool.request()
                .input('id', documentId)
                .query('SELECT Content FROM LegalDocuments WHERE Id = @id');

            const oldContent = oldDocResult.recordset[0]?.Content || '';

            // Nếu nội dung mới rỗng -> dùng lại nội dung cũ
            finalContent = (data.content && data.content.trim() !== '') ? data.content : oldContent;

            // KIỂM TRA: Nếu nội dung y hệt cũ -> Không cần tốn tiền chạy lại Embedding/Pinecone
            if (finalContent === oldContent && oldContent !== '') {
                shouldReVectorize = false;
            }

            // CẬP NHẬT SQL
            await pool.request()
                .input('id', documentId)
                .input('title', data.title)
                .input('documentNumber', data.documentNumber || null)
                .input('issueYear', data.issueYear || null)
                .input('status', data.status || 'Còn hiệu lực')
                .input('category', data.category || 'Lĩnh vực khác')
                .input('content', finalContent)
                .input('sourceUrl', data.sourceUrl || null)
                .query(`
                    UPDATE LegalDocuments
                    SET Title = @title,
                        DocumentNumber = @documentNumber,
                        IssueYear = @issueYear,
                        Status = @status,
                        Category = @category,
                        Content = @content,
                        SourceUrl = @sourceUrl,
                        SyncStatusSsms = 'success',
                        SyncStatusPinecone = 'syncing'
                    WHERE Id = @id
                `);

         
           // Chỉ xóa vector cũ nếu nội dung có thay đổi
            if (shouldReVectorize) {
                try {
                    // Dùng cú pháp trực tiếp không qua filter: { $eq: ... }
                    await pineconeIndex.deleteMany({ doc_id: documentId.toString() });
                } catch (err) { console.warn("Lỗi xóa vector cũ Pinecone:", err.message); }
            }

        } else {
            // LUỒNG INSERT MỚI HOÀN TOÀN
            console.log(`Generated document ID: ${documentId}`);


            // 1. CHÈN LOGIC CHECK TỒN TẠI 
            if (!isUpdate) {
                // 1. KIỂM TRA ĐỒNG BỘ 
                const checkStatus = await pool.request()
                    .input('id', documentId)
                    .query('SELECT SyncStatusSsms, SyncStatusPinecone FROM LegalDocuments WHERE Id = @id');

                const existingDoc = checkStatus.recordset[0];

                if (existingDoc) {
                    if (existingDoc.SyncStatusPinecone === 'success') {
                        // Nếu đã xanh (Vectored), báo lỗi trùng để tránh rác Pinecone
                        return {
                            success: false,
                            error: 'DUPLICATE_DOCUMENT',
                            message: 'Văn bản đã tồn tại và đã được vector hóa thành công.'
                        };
                    } else {
                        // Nếu chưa xanh, tự động gọi lại hàm này ở chế độ Update để vá lỗi
                        console.log(`[legalDataService] Phát hiện lỗi đồng bộ cho ID: ${documentId}. Đang tự động Retry Sync...`);
                        data.id = documentId; // Gán ID để khớp với luồng Update
                        return upsertLegalData(data, true);
                    }
                }
            }


            // XỬ LÝ INSERT (Văn bản mới)
            const result = await pool.request()
                .input('id', documentId)
                .input('title', data.title)
                .input('documentNumber', data.documentNumber || null)
                .input('issueYear', data.issueYear || null)
                .input('status', data.status || 'Còn hiệu lực')
                .input('category', data.category || 'Lĩnh vực khác')
                .input('content', finalContent)
                .input('sourceUrl', data.sourceUrl || null)
                .query(`
                    INSERT INTO LegalDocuments
                        (Id, Title, DocumentNumber, IssueYear, Status, Category, Content, CreatedAt, SourceUrl, SyncStatusSsms, SyncStatusPinecone)
                    VALUES
                        (@id, @title, @documentNumber, @issueYear, @status, @category, @content, GETDATE(), @sourceUrl, 'success', 'syncing')
                    RETURNING Id
                `);
            documentId = result.recordset[0].Id;
        }

        ssmsStatus = 'success';

        // 4. CHỈ CHẠY PINECONE NẾU CẦN THIẾT
        if (shouldReVectorize) {
            const chunks = chunkText(finalContent, 1500, 200);
            const vectors = [];

            for (let index = 0; index < chunks.length; index += 1) {
                const chunk = chunks[index];
                const embeddingResult = await embedModel.embedContent(chunk);
                const vectorValues = Array.from(embeddingResult.embedding.values);

                vectors.push({
                    id: `${documentId}_${index}`,
                    values: vectorValues,
                    metadata: {
                        doc_id: documentId.toString(),
                        title: data.title,
                        documentNumber: data.documentNumber || null,
                        issueYear: data.issueYear || null,
                        status: data.status || 'Còn hiệu lực',
                        category: data.category || 'Lĩnh vực khác',
                        text: chunk
                    }
                });
            }

            if (vectors.length > 0) {
                await pineconeIndex.upsert(vectors);
            }
        }

        pineconeStatus = 'success';
        await updateSyncStatus(documentId, ssmsStatus, pineconeStatus);

        return { success: true, documentId, syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus } };
    } catch (error) {
        console.error('[legalDataService] upsertLegalData error:', error.message || error);
        if (ssmsStatus !== 'success') ssmsStatus = 'error';
        pineconeStatus = 'error';
        if (documentId) {
            try { await updateSyncStatus(documentId, ssmsStatus, pineconeStatus); } catch (updateErr) { }
        }
        return { success: false, error: error.message, syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus } };
    }
};
const deleteLegalData = async (documentId) => {
    await poolConnect;
    initCloudServices();

    let pineconeStatus = 'syncing';
    let ssmsStatus = 'syncing';

    try {
        // 1. XÓA TRÊN PINECONE ĐẦU TIÊN

   
        try {
            // Bỏ $eq, dùng object trực tiếp - Đây là cách "cứu cánh" khi $eq bị lỗi illegal
            await pineconeIndex.deleteMany({ 
                doc_id: documentId.toString() 
            });
            pineconeStatus = 'success';
            console.log(` Đã xóa các vector của ID: ${documentId}`);
        } catch (pcError) {
            // Nếu vẫn lỗi illegal condition, có nghĩa là bản ghi này không có Metadata doc_id
            console.warn(' Pinecone không tìm thấy vector để xóa hoặc lỗi Filter:', pcError.message);
            pineconeStatus = 'success'; // Vẫn cho qua để xóa nốt ở SQL
        }

        // 2. XÓA TRONG SQL SERVER (SSMS)
        await pool.request()
            .input('id', documentId)
            .query('DELETE FROM LegalDocuments WHERE Id = @id');
        ssmsStatus = 'success';

        // Nếu SQL xóa thành công thì xem như thành công, Pinecone lỗi thì báo trạng thái vàng
        return { success: true, syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus } };

    } catch (error) {
        console.error(' [legalDataService] deleteLegalData error:', error.message || error);
        ssmsStatus = 'error';
        return {
            success: false,
            error: error.message || 'Failed to delete legal data from SQL',
            syncStatus: { ssms: ssmsStatus, pinecone: pineconeStatus }
        };
    }
};
const getLegalDocuments = async ({ page = 1, limit = 10, search = '', category = '', status = '' }) => {
    await poolConnect;

    let whereClauses = [];
    const request = pool.request();

    if (search) {
        request.input('search', `%${search}%`);
        whereClauses.push('(Title LIKE @search OR Content LIKE @search)');
    }
    if (category) {
        request.input('category', category);
        whereClauses.push('Category = @category');
    }
    if (status) {
        request.input('status', status);
        whereClauses.push('Status = @status');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const query = `
        SELECT Id, Title, DocumentNumber, IssueYear, Status, Category, LEFT(Content, 240) AS ContentPreview,
               CreatedAt, SourceUrl, SyncStatusSsms, SyncStatusPinecone
        FROM LegalDocuments
        ${whereSql}
        ORDER BY CreatedAt DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const countQuery = `SELECT COUNT(*) AS total FROM LegalDocuments ${whereSql}`;

    const [dataResult, countResult] = await Promise.all([
        request.query(query),
        request.query(countQuery)
    ]);

    const totalItems = countResult.recordset[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    return {
        data: dataResult.recordset,
        currentPage: page,
        totalPages,
        totalItems
    };
};

const getDocumentChunks = async (documentId) => {
    await poolConnect;
    const result = await pool.request()
        .input('id', documentId)
        .query('SELECT Content FROM LegalDocuments WHERE Id = @id');

    if (!result.recordset.length) {
        throw new Error('Document not found');
    }

    return chunkText(result.recordset[0].Content, 1500, 200);
};

/**
 * Chuyển đổi tiêu đề luật phức tạp thành slug chuyên nghiệp
 * Ví dụ: "LUẬT ĐẤT ĐAI SỐ 31/2024/QH15, LUẬT NHÀ Ở..." -> "luat-dat-dai-so-31-2024-qh15-luat-nha-o-..."
 */
const convertLegalStringToSlug = (str) => {
    if (!str) return '';

    return str
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD') // Tách dấu
        .replace(/[\u0300-\u036f]/g, '') // Xóa dấu
        .replace(/[đĐ]/g, 'd') // Xử lý chữ đ
        // Thay thế TẤT CẢ các ký tự đặc biệt (/, ,, ., :, ;) và khoảng trắng thành dấu '-'
        // Chỉ giữ lại chữ cái a-z và số 0-9
        .replace(/[^a-z0-9]+/g, '-')
        // Xử lý các dấu gạch ngang bị lặp lại (do dấu phẩy + khoảng trắng tạo ra)
        .replace(/-+/g, '-')
        // Cắt bỏ dấu gạch ngang ở đầu và cuối chuỗi
        .replace(/^-+|-+$/g, '');
};

module.exports = {
    upsertLegalData,
    deleteLegalData,
    getLegalDocuments,
    getDocumentChunks
};