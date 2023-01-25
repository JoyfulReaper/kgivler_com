CREATE PROCEDURE [dbo].[spPageHit_Increment]
	@path VARCHAR(500)
AS
BEGIN
	SET NOCOUNT ON;
	
	DECLARE @count INT = (SELECT
		p.Hits
	FROM 
		PageHits p
	WHERE
		p.Path = @path);

	IF @count IS NULL
		BEGIN
			INSERT INTO PageHits 
				(Path,
				Hits)
			VALUES
				(@path,
				1);
		END
	ELSE
		BEGIN
			UPDATE PageHits
			SET Hits = @count + 1
			WHERE Path = @path;
		END
		
	IF @Count IS NULL
	 SELECT 1;
	ELSE
	SELECT @count + 1;
END