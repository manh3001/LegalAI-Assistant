// Mock data cho LegalRecordPage
export const mockRecords = [
  {
    id: "29",
    name: 'Lập kế hoạch: "Lập kế hoạch chi tiết cho đợt ra quân t..."',
    date: "28/4/2026",
    type: "PLANNING",
    riskScore: null,
    fullData: {
      Id: "29",
      UserId: "4",
      FileName: "Plan_1777372938709.json",
      OriginalFileName: null,
      FilePath: null,
      Title: 'Lập kế hoạch: "Lập kế hoạch chi tiết cho đợt ra quân t..."',
      RecordType: "PLANNING",
      RiskScore: null,
      CreatedAt: "2026-04-28T10:30:00Z",
    },
  },
  {
    id: "25",
    name: "Biểu mẫu: HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC)",
    date: "23/4/2026",
    type: "FORM",
    riskScore: null,
    fullData: {
      Id: "25",
      UserId: "4",
      FileName: "HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC).docx",
      OriginalFileName: null,
      FilePath: null,
      Title: "Biểu mẫu: HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC)",
      RecordType: "FORM",
      RiskScore: null,
      CreatedAt: "2026-04-23T14:20:00Z",
    },
  },
  {
    id: "21",
    name: "Thảo luận: Quy định về thời gian thử việc theo...",
    date: "20/4/2026",
    type: "CHAT",
    riskScore: null,
    fullData: {
      Id: "21",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T09:15:00Z",
    },
  },
  {
    id: "20",
    name: "Thảo luận: Quy định về thời gian thử việc theo...",
    date: "20/4/2026",
    type: "CHAT",
    riskScore: null,
    fullData: {
      Id: "20",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T08:45:00Z",
    },
  },
  {
    id: "19",
    name: "Thảo luận: Quy định về thời gian thử việc theo...",
    date: "20/4/2026",
    type: "CHAT",
    riskScore: null,
    fullData: {
      Id: "19",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T08:30:00Z",
    },
  },
  {
    id: "18",
    name: "Thảo luận: Quy định về thời gian thử việc theo...",
    date: "20/4/2026",
    type: "CHAT",
    riskScore: null,
    fullData: {
      Id: "18",
      UserId: "4",
      FileName: null,
      OriginalFileName: null,
      FilePath: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T08:00:00Z",
    },
  },
];

// Mock data cho pagination
export const mockPagination = {
  currentPage: 1,
  totalPages: 5,
  totalDocs: 28,
};

// Hàm helper để lấy mock data (mô phỏng API response)
export const getMockRecordsResponse = (page = 1, limit = 6, search = "") => {
  let filtered = mockRecords;

  if (search) {
    filtered = mockRecords.filter(
      (record) =>
        record.name.toLowerCase().includes(search.toLowerCase()) ||
        record.type.toLowerCase().includes(search.toLowerCase()),
    );
  }

  return {
    success: true,
    data: filtered.slice((page - 1) * limit, page * limit),
    currentPage: page,
    totalPages: Math.ceil(filtered.length / limit),
    totalDocs: filtered.length,
  };
};

// CONFIG: Bật/tắt mock mode tại đây
export const USE_MOCK_DATA = false; // Đổi thành true để dùng mock data

// ============ MOCK DATA CHI TIẾT CHO TỪNG TYPE ============
const mockDetailedRecords = {
  29: {
    success: true,
    data: {
      Id: "29",
      UserId: "4",
      FileName: "Plan_1777372938709.json",
      Title: 'Lập kế hoạch: "Lập kế hoạch chi tiết cho đợt ra quân t..."',
      Description:
        "Kế hoạch chi tiết cho đợt ra quân và thực hiện các hoạt động nội bộ.",
      RecordType: "PLANNING",
      RiskScore: null,
      CreatedAt: "2026-04-28T10:30:00Z",
      Content: JSON.stringify({
        steps: [
          {
            id: 1,
            title: "Chuẩn bị tài liệu cơ bản",
            description: "Soạn thảo, kiểm duyệt các giấy tờ pháp lý ban đầu",
            timeline: "Ngày 1-3",
            status: "completed",
          },
          {
            id: 2,
            title: "Thành lập ban điều hành",
            description: "Lựa chọn và bổ nhiệm các thành viên chủ chốt",
            timeline: "Ngày 4-5",
            status: "completed",
          },
          {
            id: 3,
            title: "Khởi động chiến dịch",
            description: "Công bố chính thức và bắt đầu các hoạt động",
            timeline: "Ngày 6",
            status: "in-progress",
          },
          {
            id: 4,
            title: "Theo dõi & Đánh giá",
            description: "Giám sát tiến độ và điều chỉnh kế hoạch",
            timeline: "Ngày 7-30",
            status: "pending",
          },
        ],
        summary: "Kế hoạch 4 bước để thực thi chiến lược nội bộ",
      }),
    },
  },
  25: {
    success: true,
    data: {
      Id: "25",
      UserId: "4",
      FileName: "HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC).docx",
      Title: "Biểu mẫu: HỢP ĐỒNG HỢP TÁC KINH DOANH (BCC)",
      Description: "Mẫu hợp đồng hợp tác kinh doanh tiêu chuẩn.",
      RecordType: "FORM",
      RiskScore: null,
      CreatedAt: "2026-04-23T14:20:00Z",
      Content: JSON.stringify({
        fields: [
          { key: "BênA", value: "Công ty ABC Việt Nam" },
          { key: "BênB", value: "Công ty XYZ Đối tác" },
          { key: "PhạmVị", value: "Phân phối sản phẩm công nghệ" },
          { key: "ThờiHạn", value: "24 tháng kể từ ngày ký" },
          { key: "GiáTrị", value: "2,000,000,000 VND" },
          { key: "ĐiềuKiệnTTThế", value: "Hàng quý, trước ngày 10 của tháng" },
          {
            key: "HànhSử",
            value: "Khởi động: 01/05/2026, Kết thúc: 30/04/2028",
          },
        ],
        summary: "Hợp đồng hợp tác kinh doanh giữa hai bên",
      }),
    },
  },
  21: {
    success: true,
    data: {
      Id: "21",
      UserId: "4",
      FileName: null,
      Title: "Thảo luận: Quy định về thời gian thử việc theo Bộ luật Lao động",
      Description:
        "Cuộc thảo luận về các quy định liên quan đến thời gian thử việc.",
      RecordType: "CHAT",
      RiskScore: null,
      CreatedAt: "2026-04-20T09:15:00Z",
      Content: JSON.stringify({
        messages: [
          {
            id: "msg-1",
            text: "Thời gian thử việc tối đa là bao lâu theo luật Việt Nam?",
            isBot: false,
            timestamp: "2026-04-20T09:00:00Z",
          },
          {
            id: "msg-2",
            text: "Theo Bộ luật Lao động 2019, thời gian thử việc tối đa là 3 tháng. Tuy nhiên, có thể rút ngắn nếu cần thiết hoặc tối đa 1 tháng đối với lao động chưa qua đào tạo.",
            isBot: true,
            timestamp: "2026-04-20T09:15:00Z",
          },
          {
            id: "msg-3",
            text: "Tôi cần ký hợp đồng thử việc như thế nào?",
            isBot: false,
            timestamp: "2026-04-20T09:20:00Z",
          },
          {
            id: "msg-4",
            text: "Hợp đồng thử việc phải được lập bằng văn bản, ghi rõ: thời gian thử việc, công việc, mức lương, quyền lợi và tiền lương thử việc.",
            isBot: true,
            timestamp: "2026-04-20T09:25:00Z",
          },
        ],
        summary: "Tư vấn về thời gian thử việc theo quy định pháp luật",
      }),
    },
  },
  20: {
    success: true,
    data: {
      Id: "20",
      UserId: "4",
      Title: "Thảo luận: Quy định về thời gian thử việc theo...",
      RecordType: "CHAT",
      CreatedAt: "2026-04-20T08:45:00Z",
      Content: JSON.stringify({
        messages: [
          {
            id: "msg-1",
            text: "Làm sao để hủy hợp đồng lao động?",
            isBot: false,
          },
          {
            id: "msg-2",
            text: "Hủy hợp đồng có 2 cách: (1) Thỏa thuận chung, (2) Đơn phía theo quy định.",
            isBot: true,
          },
        ],
      }),
    },
  },
  19: {
    success: true,
    data: {
      Id: "19",
      UserId: "4",
      Title: "Thảo luận: Mục đích của phí bảo hành",
      RecordType: "CHAT",
      CreatedAt: "2026-04-20T08:30:00Z",
      Content: JSON.stringify({
        messages: [
          {
            id: "msg-1",
            text: "Phí bảo hành là gì?",
            isBot: false,
          },
          {
            id: "msg-2",
            text: "Phí bảo hành là khoản tiền được trích từ tiền lương để bảo đảm lao động thực hiện đúng quy định.",
            isBot: true,
          },
        ],
      }),
    },
  },
  18: {
    success: true,
    data: {
      Id: "18",
      UserId: "4",
      Title: "Thảo luận: Quy định về 30% phí bảo hành",
      RecordType: "CHAT",
      CreatedAt: "2026-04-20T08:00:00Z",
      Content: JSON.stringify({
        messages: [
          {
            id: "msg-1",
            text: "Có được trích 30% phí bảo hành từ tiền lương?",
            isBot: false,
          },
          {
            id: "msg-2",
            text: "Không được trích quá 30% tiền lương của lao động. Phải tuân thủ quy định tối cao này.",
            isBot: true,
          },
        ],
      }),
    },
  },
};

// Mock data cho ANALYSIS type (thêm mới)
mockDetailedRecords["26"] = {
  success: true,
  data: {
    Id: "26",
    UserId: "4",
    FileName: "Contract_Analysis_20260425.json",
    Title: "Thẩm định: Hợp đồng Dịch vụ Tư vấn Pháp lý",
    Description: "Phân tích chi tiết về các rủi ro pháp lý trong hợp đồng.",
    RecordType: "ANALYSIS",
    RiskScore: 72,
    CreatedAt: "2026-04-25T14:30:00Z",
    Content: JSON.stringify({
      summary:
        "Hợp đồng có rủi ro trung bình. Cần xem xét thêm một số điều khoản liên quan bảo vệ quyền lợi.",
      risks: [
        {
          id: 1,
          clause: "Điều 5.1",
          issue: "Điều khoản thanh toán không rõ thời hạn",
          description:
            "Hợp đồng không nêu rõ thời hạn thanh toán cụ thể, chỉ nói 'khi hoàn tất công việc'. Điều này gây tranh cãi.",
          severity: "high",
          recommendation:
            "Nên thêm: 'Thanh toán trong vòng 30 ngày kể từ khi nhận invoice'",
        },
        {
          id: 2,
          clause: "Điều 8.2",
          issue: "Hạn chế trách nhiệm không cân bằng",
          description:
            "Nhà cung cấp hạn chế trách nhiệm lên tới 50% nhưng bên thuê không có quyền tương tự.",
          severity: "medium",
          recommendation: "Đàm phán để cân bằng trách nhiệm hai bên",
        },
        {
          id: 3,
          clause: "Điều 3",
          issue: "Quyền sở hữu trí tuệ không được định rõ",
          description:
            "Chưa có điều khoản về quyền sở hữu trí tuệ của các tài liệu được tạo ra.",
          severity: "medium",
          recommendation: "Thêm mục 'Quyền sở hữu trí tuệ' để tránh tranh chấp",
        },
      ],
    }),
  },
};

// Mock data cho VIDEO_ANALYSIS type
mockDetailedRecords["27"] = {
  success: true,
  data: {
    Id: "27",
    UserId: "4",
    FileName: "video_analysis_20260424.json",
    Title: "Thẩm định: Video Hướng dẫn Quy trình Hành chính",
    Description: "Phân tích nội dung pháp lý từ video hướng dẫn.",
    RecordType: "VIDEO_ANALYSIS",
    RiskScore: 85,
    CreatedAt: "2026-04-24T10:00:00Z",
    Content: JSON.stringify({
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      summary: "Video hướng dẫn đầy đủ và chính xác về quy trình hành chính.",
      timestamps: [
        {
          id: 1,
          time: "00:15",
          title: "Giới thiệu quy trình chung",
          issue: null,
          description: "Giải thích rõ ràng các bước cơ bản",
        },
        {
          id: 2,
          time: "02:30",
          title: "Yêu cầu tài liệu cần thiết",
          issue: "Thiếu thông tin về hạn chế tuổi",
          description: "Nên thêm yêu cầu về độ tuổi tối thiểu",
          severity: "medium",
        },
        {
          id: 3,
          time: "05:45",
          title: "Quy trình nộp đơn",
          issue: null,
          description: "Hướng dẫn chi tiết từng bước",
        },
      ],
    }),
  },
};

// Hàm lấy mock detail by ID
export const getMockDetailResponse = (id) => {
  return (
    mockDetailedRecords[id] || {
      success: false,
      message: "Không tìm thấy hồ sơ",
    }
  );
};
