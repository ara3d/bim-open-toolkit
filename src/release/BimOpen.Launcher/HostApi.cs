using System.Text;

namespace BimOpen.Launcher;

/// <summary>Requests to a host on a loopback port.</summary>
public sealed class HostApi(int port, HttpClient http) : IHostApi
{
    public int Port => port;

    public async Task<(int Status, string Body)> Get(string path)
    {
        using var response = await http.GetAsync(HostArguments.Url(port, path));
        return ((int)response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    public async Task<(int Status, string Body)> Put(string path, string json)
    {
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await http.PutAsync(HostArguments.Url(port, path), content);
        return ((int)response.StatusCode, await response.Content.ReadAsStringAsync());
    }
}
