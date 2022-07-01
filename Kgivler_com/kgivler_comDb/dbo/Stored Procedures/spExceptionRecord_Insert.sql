CREATE PROCEDURE [dbo].[spExceptionRecord_Insert]
	@Message NVARCHAR(1000),
	@StackTrace NVARCHAR(3000)
AS
BEGIN
	INSERT INTO [dbo].[ExceptionRecords]
		([Message], 
		[StackTrace])
	VALUES
		(@Message,
		@StackTrace);
END