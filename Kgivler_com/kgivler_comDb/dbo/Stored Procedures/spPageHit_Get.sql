CREATE PROCEDURE [dbo].[spPageHit_Get]
	@path varchar(500)
AS
BEGIN
	SET NOCOUNT ON;
	
	SELECT 
		[Id], 
		[Path],
		[Hits] 
	FROM
		[dbo].[PageHits] WHERE [path] = @path;
END