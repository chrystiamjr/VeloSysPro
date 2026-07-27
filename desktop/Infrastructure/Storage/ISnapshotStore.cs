using System.Collections.Generic;

namespace VeloSysPro
{
    /// <summary>
    /// Persistence seam for Optimization Snapshots. Callers depend only on this interface so the
    /// append-only JSONL backing can be swapped for a database without touching them
    /// (see docs/adr/0007-jsonl-snapshot-store.md).
    /// </summary>
    public interface ISnapshotStore
    {
        void Append(OptimizationSnapshot snapshot);

        /// <summary>Every persisted Snapshot, oldest first. Never throws on damaged storage.</summary>
        IReadOnlyList<OptimizationSnapshot> ReadAll();
    }
}
