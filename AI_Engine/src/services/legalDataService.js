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

        if (isUpdate) {
            documentId = data.id;

            // 1. LẤY DATA CŨ BẢO VỆ NỘI DUNG (Tránh bị xóa trắng do UI gửi lên rỗng)
            const oldDocResult = await pool.request()
                .input('id', documentId)
                .query('SELECT Content FROM LegalDocuments WHERE Id = @id');

            const oldContent = oldDocResult.recordset[0]?.Content || '';

            // Lấy nội dung mới, nếu rỗng thì dùng lại nội dung cũ
            finalContent = (data.content && data.content.trim() !== '') ? data.content : oldContent;

            // 2. KIỂM TRA: Nếu nội dung y hệt cũ -> KHÔNG tốn tiền chạy lại Pinecone
            if (finalContent === oldContent) {
                shouldReVectorize = false;
            }

            // 3. FULL UPDATE XUỐNG SQL
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

            // Xóa vector cũ nếu cần update lại Vector mới
            if (shouldReVectorize) {
                try {
                    await pineconeIndex.deleteMany({ filter: { doc_id: documentId.toString() } });
                } catch (err) { console.warn("Lỗi xóa vector cũ Pinecone:", err.message); }
            }

        } else {
            // XỬ LÝ INSERT (Văn bản mới)
            const result = await pool.request()
                .input('title', data.title)
                .input('documentNumber', data.documentNumber || null)
                .input('issueYear', data.issueYear || null)
                .input('status', data.status || 'Còn hiệu lực')
                .input('category', data.category || 'Lĩnh vực khác')
                .input('content', finalContent)
                .input('sourceUrl', data.sourceUrl || null)
                .query(`
                    INSERT INTO LegalDocuments
                        (Title, DocumentNumber, IssueYear, Status, Category, Content, CreatedAt, SourceUrl, SyncStatusSsms, SyncStatusPinecone)
                    OUTPUT INSERTED.Id
                    VALUES
                        (@title, @documentNumber, @issueYear, @status, @category, @content, GETDATE(), @sourceUrl, 'success', 'syncing')
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
                        doc_id: documentId.toString(), // 🛠️ FIX BUG: Thêm doc_id để hàm Delete của bạn hoạt động được
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
                await pineconeIndex.upsert({ vectors });
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
            try { await updateSyncStatus(documentId, ssmsStatus, pineconeStatus); } catch (updateErr) {}
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
            // 🛠️ ĐÃ SỬA: Đổi 'documentId' thành 'doc_id' để khớp 100% với metadata lúc nạp
            await pineconeIndex.deleteMany({ filter: { doc_id: documentId.toString() } });
            pineconeStatus = 'success';
        } catch (pcError) {
            console.error(' Lỗi xóa Pinecone (Có thể vector chưa tồn tại):', pcError.message);
            pineconeStatus = 'error'; // Vẫn ghi nhận lỗi nhưng không làm sập tiến trình xóa SQL
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

module.exports = {
    upsertLegalData,
    deleteLegalData,
    getLegalDocuments,
    getDocumentChunks
};