CREATE TABLE [dbo].[ExceptionRecords]
(
	[ExceptionRecordId] INT NOT NULL PRIMARY KEY IDENTITY, 
    [Message] VARCHAR(1000) NOT NULL, 
    [StackTrace] VARCHAR(1000) NOT NULL
)
