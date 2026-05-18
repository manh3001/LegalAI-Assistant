-- =====================================================
-- TẠOẢNG FEEDBACKS - QUẢN LÝ PHẢN HỒI NGƯỜI DÙNG
-- =====================================================

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Feedbacks' AND xtype='U')
BEGIN
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;

    CREATE TABLE [dbo].[Feedbacks](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [UserId] [bigint] NOT NULL,
        [Name] [nvarchar](200) NOT NULL,
        [Email] [nvarchar](320) NOT NULL,
        [Type] [nvarchar](100) NOT NULL,
        [Rating] [int] NULL,
        [Content] [nvarchar](max) NOT NULL,
        [Status] [nvarchar](20) NOT NULL DEFAULT 'Pending',
        [ReplyContent] [nvarchar](max) NULL,
        [CreatedAt] [datetime2](7) NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] [datetime2](7) NULL,
        
        PRIMARY KEY CLUSTERED ([Id] ASC) WITH (
            PAD_INDEX = OFF,
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON,
            ALLOW_PAGE_LOCKS = ON
        ) ON [PRIMARY],
        
        FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];

    -- Tạo index để tối ưu truy vấn
    CREATE NONCLUSTERED INDEX [IX_Feedbacks_UserId] 
    ON [dbo].[Feedbacks] ([UserId] ASC);
    
    CREATE NONCLUSTERED INDEX [IX_Feedbacks_Status] 
    ON [dbo].[Feedbacks] ([Status] ASC);
    
    CREATE NONCLUSTERED INDEX [IX_Feedbacks_CreatedAt] 
    ON [dbo].[Feedbacks] ([CreatedAt] DESC);

    PRINT 'Bảng Feedbacks đã được tạo thành công!';
END
ELSE
BEGIN
    PRINT 'Bảng Feedbacks đã tồn tại. Bỏ qua việc tạo.';
END;
GO
