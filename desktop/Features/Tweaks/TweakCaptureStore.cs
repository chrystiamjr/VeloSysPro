using System;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    /// <summary>Persists the prior state captured before a Tweak was applied.</summary>
    public interface ITweakCaptureStore
    {
        void Save(TweakCapture capture);

        /// <summary>The newest capture for a Tweak, or null when it was never applied.</summary>
        TweakCapture? LoadLatest(string tweakId);
    }

    /// <summary>
    /// One JSON file per capture under %LOCALAPPDATA%\VeloSysPro\captures, named
    /// <c>&lt;tweakId&gt;_&lt;utc stamp&gt;.json</c>.
    /// </summary>
    /// <remarks>
    /// Keeping every capture rather than overwriting one file per Tweak means an apply/revert cycle
    /// leaves an audit trail, and the timestamped name sorts newest-last without reading any file.
    /// Reads are defensive for the same reason the Snapshot store is: a half-written capture must
    /// not hide the previous, still-valid one.
    /// </remarks>
    public sealed class JsonTweakCaptureStore : ITweakCaptureStore
    {
        /// <summary>A Tweak id becomes part of a file name, so it may not contain path syntax.</summary>
        private static readonly Regex SafeTweakId = new(@"^[A-Za-z0-9_.\-]+$", RegexOptions.Compiled);

        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
        };

        private readonly string _capturesDir;

        public JsonTweakCaptureStore(string? capturesDir = null)
        {
            _capturesDir = string.IsNullOrWhiteSpace(capturesDir) ? AppPaths.Captures : capturesDir;
            Directory.CreateDirectory(_capturesDir);
        }

        public void Save(TweakCapture capture)
        {
            if (!SafeTweakId.IsMatch(capture.TweakId))
                throw new ArgumentException("Invalid Tweak id.");

            string file = Path.Combine(
                _capturesDir,
                capture.TweakId
                    + "_"
                    + DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff", CultureInfo.InvariantCulture)
                    + ".json"
            );
            File.WriteAllText(file, JsonSerializer.Serialize(capture, Options), Encoding.UTF8);
        }

        public TweakCapture? LoadLatest(string tweakId)
        {
            if (!SafeTweakId.IsMatch(tweakId)) return null;

            string[] files;
            try
            {
                files = Directory.GetFiles(_capturesDir, tweakId + "_*.json");
            }
            catch
            {
                return null;
            }

            Array.Sort(files, StringComparer.Ordinal);

            for (int i = files.Length - 1; i >= 0; i--)
            {
                try
                {
                    TweakCapture? capture = JsonSerializer.Deserialize<TweakCapture>(
                        File.ReadAllText(files[i], Encoding.UTF8),
                        Options
                    );
                    if (capture != null) return capture;
                }
                catch
                {
                    // A capture damaged by a crash must not mask the previous, still-usable one.
                }
            }

            return null;
        }
    }
}
