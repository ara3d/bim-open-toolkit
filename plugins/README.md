# plugins

Revit 2025 add-ins and the Revit utility library. None of these are NuGet
packages; they build into add-in folders.

| Project | Role |
|---|---|
| `Ara3D.BIMOpenSchema.Revit2025` | The BIM Open Schema exporter add-in: writes a `.bos` archive from the open Revit document. |
| `Ara3D.Bowerbird.Revit2025` | The Bowerbird add-in host: compiles and runs per-folder C# commands inside Revit. The Bowerbird core (Roslyn compile and run) stays in the Ara3D SDK under `submodules/ara3d-sdk/plugins`. |
| `Ara3D.Bowerbird.RevitSamples` | Sample Bowerbird commands for Revit, including the background BOS exporter form. |
| `Ara3D.Revit.Utils` | Extension methods over the Revit database API: collectors, creation, export, families, annotation. References `RevitAPI.dll` only, so it works under Design Automation. |

The Revit API assemblies come from the `Revit_All_Main_Versions_API_x64` NuGet
package pinned in `Directory.Build.props`, with runtime assets excluded so the
DLLs are never copied into an add-in folder. Revit itself is not needed to
build. Each add-in's `post-build.bat` installs it into
`%AppData%\Autodesk\Revit\Addins\2025` when that folder exists and skips
quietly otherwise.
