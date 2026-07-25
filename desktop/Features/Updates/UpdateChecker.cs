using System;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;

namespace VeloSysPro
{
    /// <summary>
    /// Checks the GitHub Releases API for a newer version. Read-only, best-effort:
    /// any network/parse failure is swallowed and treated as "no update".
    /// </summary>
    public static class UpdateChecker
    {
        public record UpdateInfo(string Version, string Url);

        private const string Owner = "chrystiamjr";
        private const string Repo = "VeloSysPro";

        private static readonly HttpClient Http = CreateClient();

        private static HttpClient CreateClient()
        {
            var client = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("VeloSysPro-UpdateCheck");
            return client;
        }

        public static async Task<UpdateInfo?> CheckAsync()
        {
            try
            {
                string apiUrl = $"https://api.github.com/repos/{Owner}/{Repo}/releases/latest";
                string json = await Http.GetStringAsync(apiUrl);

                using JsonDocument doc = JsonDocument.Parse(json);
                JsonElement root = doc.RootElement;

                string tag = root.TryGetProperty("tag_name", out JsonElement t) ? t.GetString() ?? "" : "";
                string htmlUrl = root.TryGetProperty("html_url", out JsonElement h) ? h.GetString() ?? "" : "";

                Version? latest = ParseVersion(tag);
                Version current = Assembly.GetExecutingAssembly().GetName().Version ?? new Version(1, 0, 0, 0);

                if (latest != null && latest > current)
                {
                    return new UpdateInfo(tag, htmlUrl);
                }
                return null;
            }
            catch
            {
                return null;
            }
        }

        private static Version? ParseVersion(string tag)
        {
            string cleaned = tag.TrimStart('v', 'V');
            return Version.TryParse(cleaned, out Version? v) ? v : null;
        }
    }
}
