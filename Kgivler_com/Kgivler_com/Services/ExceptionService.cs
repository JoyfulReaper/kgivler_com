using Dapper;
using kgivler_com.Models;
using Microsoft.Data.SqlClient;
using System.Data;

namespace kgivler_com.Services;

public class ExceptionService
{
    private readonly IConfiguration _config;
    private readonly string _connectionString;

    public ExceptionService(IConfiguration config)
    {
        _config = config;
        _connectionString = _config.GetConnectionString("DefaultConnection");
    }

    public async Task SaveAsync(ExceptionRecord exceptionRecord)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.ExecuteAsync("spExceptionRecord_Insert", new
        {
            exceptionRecord.Message,
            exceptionRecord.StackTrace
        }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<ExceptionRecord>> GetAllAsync()
    {
        using var connection = new SqlConnection(_connectionString);
        return await connection.QueryAsync<ExceptionRecord>("spExceptionRecord_GetAll", commandType: CommandType.StoredProcedure);
    }
}
