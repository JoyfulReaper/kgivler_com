namespace Kgivler_com.Services
{
    public interface IHitCounterService
    {
        Task<int> GetPageHits(string path);
        Task<int> PageHitIncrement(string path);
    }
}
