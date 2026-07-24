namespace VeloSysPro
{
    /// <summary>Outcome of a native command invocation.</summary>
    public record CommandResult(int ExitCode, bool Success);

    /// <summary>
    /// Process boundary used by Windows services. Tests replace it with an in-memory fake,
    /// so registry, scheduler, PowerShell and optimization commands are never executed.
    /// </summary>
    public interface ICommandRunner
    {
        CommandResult Run(string exe, string args);
        string RunCapture(string exe, string args);
        void CleanTempFolder();
        void ClearDirectory(string path);
    }
}
