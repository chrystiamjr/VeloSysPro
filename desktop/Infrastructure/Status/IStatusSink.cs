namespace VeloSysPro
{
    /// <summary>
    /// Progress/log output abstraction so the same optimization logic can drive either
    /// the WebView UI (translated in React) or a headless file log.
    /// Translatable messages travel as i18n keys + args; dynamic command output
    /// (stdout/stderr) travels as raw text.
    /// </summary>
    public interface IStatusSink
    {
        /// <summary>Emit a translatable message identified by an i18n key.</summary>
        void Log(string key, string type, object? args = null);

        /// <summary>Emit dynamic, untranslatable text (e.g. command stdout/stderr).</summary>
        void LogRaw(string text, string type);

        /// <summary>Emit a translatable status message plus a progress percentage.</summary>
        void Status(string key, int percent, object? args = null);
    }
}
