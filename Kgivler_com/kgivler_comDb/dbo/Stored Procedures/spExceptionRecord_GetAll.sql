CREATE PROCEDURE [dbo].[spExceptionRecord_GetAll]
AS
BEGIN
	SET NOCOUNT ON;
	
	SELECT 
		[ExceptionRecordId],
		[Message],
		[StackTrace] 
	FROM 
		[dbo].[ExceptionRecords]
END