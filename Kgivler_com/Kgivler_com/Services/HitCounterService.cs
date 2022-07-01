using Dapper;
using kgivler_com.Models;
using Microsoft.Data.SqlClient;
using System.Data;

namespace kgivler_com.Services;

public class HitCounterService
{
    private readonly IConfiguration _config;
    private string _connectionString = null!;

    public HitCounterService(IConfiguration config)
    {
        _config = config;
        _connectionString = _config.GetConnectionString("DefaultConnection");
    }
    
    public async Task<int> PageHitIncrementAsync(string path)
    {
        using var connection = new SqlConnection(_connectionString);
        return await connection.QuerySingleAsync<int>("spPageHit_Increment", path, commandType: CommandType.StoredProcedure);
    }

    public async Task<int> GetPageHitsAsync(string path)
    {
        using var connection = new SqlConnection(_connectionString);
        return (await connection.QuerySingleOrDefaultAsync<PageHit>("spPageHit_Get", path, commandType: CommandType.StoredProcedure)).Hits;
    }
}
