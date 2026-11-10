namespace Ertad.Api.Services;

/// <summary>Every minute: fail overdue deals, expire codes, promote waitlist, send reminders.</summary>
public class DealJob(IServiceScopeFactory scopes, ILogger<DealJob> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<DealService>().RunJobsAsync();
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Deal job failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
