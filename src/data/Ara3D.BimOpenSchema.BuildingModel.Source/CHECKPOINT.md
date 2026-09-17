# Input track checkpoint

State: verified for source/probe builds and all three real-file prepare/reopen gates; assigned integration tests deferred to supervisor.
Contract: WAVE R2 source/probe/cache ownership; API unchanged from source handoff.

Implemented a net8 source library, typed BFAST cache with column SHA-256, full source manifest, source fingerprint, geometry retention, staged preparation, core-only BimModel reopening, explicit verification and profile CLI. Tests in assigned SourceReaderTests.cs cover all row groups, nullable scalars, embedded NUL/Unicode, signed zero/infinity, geometry retention and skipping, loading without BOS, corruption rejection and source change invalidation.

Initial measured preparations (before added verification on reopening): Snowdon 3.470s / core 3.540s / peak 937MiB; Golden Nugget 2.132s / core 2.018s / peak 643.8MiB; all-medium 17.012s / core 10.336s / peak 3672.4MiB. All buffers including geometry passed post-write hashes. All-medium contains 1,237,191 entities, 42,033 descriptors and 2,918,524 properties; core load exceeded the 10-second complete-first-query target before mapping/querying.

Source/probe build succeeded with zero errors/warnings after adding Platonic.props and explicit Impure IO/decoder boundaries. Offline restore used the existing user cache with command flags RestorePackagesPath=C:/Users/cdigg/.nuget/packages, RestoreAdditionalProjectSources=C:/Users/cdigg/git/Platonic.CSharp/artifacts and NuGetAudit=false. Initial dependency rebuild surfaced a pre-existing nullable annotation warning in BimOpenSchema/DataTableFromEntities.cs; subsequent unchanged dependency builds were clean.

Final checksum-enforced reopens completed: Snowdon cache validation 0.171s / core 3.234s / peak 833.9MiB; Golden validation 0.554s / core 2.246s / peak 473.5MiB; all-medium validation 2.229s / core 9.194s / peak 2587.0MiB. These are fresh probe processes with existing OS file caches; validation hashes source plus all cache buffers, core load hashes only used core buffers. Updated profiles are `artifacts/building-model-source-probe/*.verified.json`; original initial-preparation profiles retained. Cache sizes: Snowdon 88,940,160B; Golden 88,486,720B; all-medium 1,622,158,592B.

All source/probe writes, builds and profiling processes stopped. Shared dependency outputs released to supervisor. Outstanding: supervisor's assigned tests and integrated gates. No Git index changes or commits. Limits and decoder duplication documented in README.
