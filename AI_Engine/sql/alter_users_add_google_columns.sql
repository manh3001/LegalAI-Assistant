-- Migration: add Google login related columns to existing dbo.Users table
-- Run this in your SSMS against LegalBotDB

IF COL_LENGTH('dbo.Users', 'GoogleId') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD GoogleId NVARCHAR(100) NULL;
    PRINT 'Added column GoogleId';
END
ELSE
BEGIN
    PRINT 'Column GoogleId already exists';
END

IF COL_LENGTH('dbo.Users', 'Avatar') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD Avatar NVARCHAR(1000) NULL;
    PRINT 'Added column Avatar';
END
ELSE
BEGIN
    PRINT 'Column Avatar already exists';
END

IF COL_LENGTH('dbo.Users', 'AuthProvider') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD AuthProvider NVARCHAR(50) NULL;
    PRINT 'Added column AuthProvider';
END
ELSE
BEGIN
    PRINT 'Column AuthProvider already exists';
END

IF COL_LENGTH('dbo.Users', 'Password') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Users ALTER COLUMN Password NVARCHAR(MAX) NULL;
    PRINT 'Altered Password column to allow NULLs';
END

-- Optional: create index on GoogleId for faster lookup
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_Users_GoogleId' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
    CREATE INDEX IX_Users_GoogleId ON dbo.Users (GoogleId);
    PRINT 'Created index IX_Users_GoogleId';
END
ELSE
BEGIN
    PRINT 'Index IX_Users_GoogleId already exists';
END
