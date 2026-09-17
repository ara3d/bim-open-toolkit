namespace Ara3D.BIMOpenSchema.Tests;

public static class CategoryGrouper
{
    [Test]
    public static void OutputSkippedCategories()
    {
        // Creates a JSON object that maps built-in category names to groups.
        Console.WriteLine("{");
        Console.WriteLine("\"skip_export\":");
        Console.WriteLine("[");
        foreach (var val in Enum.GetValues<BuiltInCategory>().OrderBy(v => v.ToString()))
        {
            if (ShouldSkipExport(val, true, true, true))
                Console.WriteLine($"  {val}");
        }
        Console.WriteLine("]");
        Console.WriteLine("}");
    }

    public static bool ShouldSkipExport(
        BuiltInCategory bic,
        bool skip2dItems,
        bool skipViewItems,
        bool skipAnalyticalItems)
    {
        // If bic isn't defined, Enum.GetName returns null.
        var name = Enum.GetName(typeof(BuiltInCategory), bic) ?? bic.ToString();

        // 0) Hard skip: invalid / sentinel
        if (bic == BuiltInCategory.INVALID)
            return true;

        // 1) Hard skip: explicitly obsolete / deprecated / wrong range
        // (These are never worth exporting.)
        if (name.Contains("Obsolete", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Deprecated", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("ToBeDeprecated", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("IdInWrongRange", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("OBSOLETE", StringComparison.OrdinalIgnoreCase))
            return true;

        // ---- Helpers for "keep as data, not geometry" buckets ----

        // Connectivity / topology is BIM-relevant even if you skip geometry.
        // Keep it unless you explicitly decide to remove it elsewhere.
        bool isConnectivity =
            name.Contains("Connector", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("GraphicalWarning_OpenConnector", StringComparison.OrdinalIgnoreCase) ||
            bic == BuiltInCategory.OST_ConnectorElem ||
            bic == BuiltInCategory.OST_ConnectorElemXAxis ||
            bic == BuiltInCategory.OST_ConnectorElemYAxis ||
            bic == BuiltInCategory.OST_ConnectorElemZAxis ||
            bic == BuiltInCategory.OST_ElectricalConnector;

        // Point clouds are heavy, but valuable context.
        // Keep as "reference-only" (path/guid/transform/bounds) in your exporter.
        bool isPointCloud = (bic == BuiltInCategory.OST_PointClouds);

        // Schedules/templates are “document-like” data. Keep only if you want non-geometry BIM docs.
        bool isScheduleOrTemplate =
            name.Contains("Schedule", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Templates", StringComparison.OrdinalIgnoreCase) ||
            bic == BuiltInCategory.OST_Schedules ||
            bic == BuiltInCategory.OST_ScheduleGraphics ||
            bic == BuiltInCategory.OST_ScheduleViewParamGroup;

        // View/presentation state (can be useful; gate behind skipViewItems)
        bool isViewState =
            bic == BuiltInCategory.OST_Views ||
            bic == BuiltInCategory.OST_Viewports ||
            bic == BuiltInCategory.OST_ViewportLabel ||
            bic == BuiltInCategory.OST_Sheets ||
            bic == BuiltInCategory.OST_Cameras ||
            bic == BuiltInCategory.OST_Camera_Lines ||
            bic == BuiltInCategory.OST_SectionBox ||
            bic == BuiltInCategory.OST_Viewers;

        // 2) Hard keep: core 3D model categories that must NEVER be skipped by heuristics
        switch (bic)
        {
            case BuiltInCategory.OST_Walls:
            case BuiltInCategory.OST_Floors:
            case BuiltInCategory.OST_Roofs:
            case BuiltInCategory.OST_Ceilings:
            case BuiltInCategory.OST_Columns:
            case BuiltInCategory.OST_Doors:
            case BuiltInCategory.OST_Windows:
            case BuiltInCategory.OST_Ramps:
            case BuiltInCategory.OST_Stairs:
            case BuiltInCategory.OST_Railings:
            case BuiltInCategory.OST_CurtainWallMullions:
            case BuiltInCategory.OST_CurtainWallPanels:
            case BuiltInCategory.OST_GenericModel:

            // Structural “real” elements
            case BuiltInCategory.OST_StructuralFraming:
            case BuiltInCategory.OST_StructuralColumns:
            case BuiltInCategory.OST_StructuralFoundation:
            case BuiltInCategory.OST_StructuralTruss:
            case BuiltInCategory.OST_StructConnections:
            case BuiltInCategory.OST_Rebar:
            case BuiltInCategory.OST_FabricReinforcement:
            case BuiltInCategory.OST_FabricAreas:
            case BuiltInCategory.OST_StructuralTendons:

            // MEP “real” elements
            case BuiltInCategory.OST_PipeCurves:
            case BuiltInCategory.OST_PipeFitting:
            case BuiltInCategory.OST_PipeAccessory:
            case BuiltInCategory.OST_DuctCurves:
            case BuiltInCategory.OST_DuctFitting:
            case BuiltInCategory.OST_DuctAccessory:
            case BuiltInCategory.OST_DuctTerminal:
            case BuiltInCategory.OST_Conduit:
            case BuiltInCategory.OST_ConduitFitting:
            case BuiltInCategory.OST_CableTray:
            case BuiltInCategory.OST_CableTrayFitting:

            // Common placed components
            case BuiltInCategory.OST_MechanicalEquipment:
            case BuiltInCategory.OST_PlumbingFixtures:
            case BuiltInCategory.OST_LightingFixtures:
            case BuiltInCategory.OST_ElectricalEquipment:
            case BuiltInCategory.OST_ElectricalFixtures:
            case BuiltInCategory.OST_Furniture:
            case BuiltInCategory.OST_Casework:
            case BuiltInCategory.OST_SpecialityEquipment:
                return false;
        }

        // 2b) Soft-keep buckets: keep as metadata/relations even if you don't render them
        // (You should still skip their geometry in the geometry exporter.)
        if (isConnectivity)
            return false;

        if (isPointCloud)
            return false;

        // Schedules/templates: export only if you are *not* skipping view/doc-like things
        if (isScheduleOrTemplate)
            return skipViewItems;

        // Views/presentation: export only if you want view state
        if (isViewState)
            return skipViewItems;

        // 3) “Probably skip”: drafting / tags / internal junk.

        // 3a) Tags and annotation-ish categories
        // NOTE: This intentionally still skips connector "Tags" (fine), while keeping connectors themselves above.
        if (name.EndsWith("Tags", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Tag", StringComparison.OrdinalIgnoreCase))
            return true;

        // 3b) Hidden lines, cut/projection, outlines, patterns: almost always view graphics
        if (name.Contains("HiddenLines", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("CutPattern", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("SurfacePattern", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Projection", StringComparison.OrdinalIgnoreCase) ||
            (name.Contains("Cut", StringComparison.OrdinalIgnoreCase) && name.Contains("Outlines", StringComparison.OrdinalIgnoreCase)) ||
            name.Contains("Outlines", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Crop", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Callout", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("SectionHead", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("TitleBlock", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("LeaderLine", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Matchline", StringComparison.OrdinalIgnoreCase))
            return true;

        // 3c) Pure 2D annotation / drafting primitives
        if (bic == BuiltInCategory.OST_TextNotes ||
            bic == BuiltInCategory.OST_FilledRegion ||
            bic == BuiltInCategory.OST_MaskingRegion ||
            bic == BuiltInCategory.OST_GenericAnnotation ||
            bic == BuiltInCategory.OST_RevisionClouds ||
            bic == BuiltInCategory.OST_RevisionCloudTags ||
            bic == BuiltInCategory.OST_SpotElevations ||
            bic == BuiltInCategory.OST_SpotCoordinates ||
            bic == BuiltInCategory.OST_SpotSlopes ||
            bic == BuiltInCategory.OST_SpotElevSymbols ||
            bic == BuiltInCategory.OST_SpotCoordinateSymbols ||
            bic == BuiltInCategory.OST_SpotSlopesSymbols ||
            bic == BuiltInCategory.OST_ElevationMarks)
            return skip2dItems;

        // 3d) Internal / UI / authoring artifacts (massive noise)
        if (name.StartsWith("OST_IOS", StringComparison.OrdinalIgnoreCase) ||
            name.StartsWith("OST_DSR_", StringComparison.OrdinalIgnoreCase) ||
            name.StartsWith("OST_XRay", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("CrashGraphics", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Regenerated", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("BackedUp", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("RegenerationFailure", StringComparison.OrdinalIgnoreCase))
            return true;

        // 3e) Compass / sun path visualization aids (keep only if exporting view graphics)
        if (name.Contains("Sun", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Compass", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Analemma", StringComparison.OrdinalIgnoreCase))
            return skipViewItems;

        // 3h) “Analytical” is optional: keep only if you want analysis model
        if (name.Contains("Analytical", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("gbXML", StringComparison.OrdinalIgnoreCase) ||
            name.StartsWith("OST_GbXML", StringComparison.OrdinalIgnoreCase))
            return skipAnalyticalItems;

        // Default: don't skip.
        return false;
    }


    /// <summary>
    /// Returns true only if elements in this category are usually
    /// visible as 3D geometry in a default 3D rendering view.
    /// Conservative: prefers false when unsure.
    /// </summary>
    public static bool IsDefaultVisible(BuiltInCategory bic)
    {
        if (!ShouldSkipExport(bic, true, true, true))
            return false;

        var name = Enum.GetName(typeof(BuiltInCategory), bic) ?? bic.ToString();

        // 3) Hard exclude: spatial / zones / fills (usually not 3D render geometry)
        if (bic == BuiltInCategory.OST_Rooms ||
            bic == BuiltInCategory.OST_Areas ||
            bic == BuiltInCategory.OST_MEPSpaces ||
            bic == BuiltInCategory.OST_HVAC_Zones ||
            bic == BuiltInCategory.OST_MassZone ||
            name.Contains("Zone", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("ColorFill", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("InteriorFill", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("ReferenceVisibility", StringComparison.OrdinalIgnoreCase))
            return false;

        // 4) Hard exclude: datums / reference geometry (visible as lines, not renderable solids)
        if (bic == BuiltInCategory.OST_Levels ||
            bic == BuiltInCategory.OST_Grids ||
            bic == BuiltInCategory.OST_GuideGrid ||
            bic == BuiltInCategory.OST_ProjectBasePoint ||
            bic == BuiltInCategory.OST_SharedBasePoint ||
            bic == BuiltInCategory.OST_LinkBasePoint ||
            bic == BuiltInCategory.OST_CoordinateSystem ||
            bic == BuiltInCategory.OST_ReferenceLines ||
            bic == BuiltInCategory.OST_ReferencePoints ||
            name.Contains("Axis", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("BasePoint", StringComparison.OrdinalIgnoreCase))
            return false;

        // 5) Hard exclude: analysis / analytical / gbXML
        if (name.Contains("Analytical", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Analytic", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("gbXML", StringComparison.OrdinalIgnoreCase) ||
            name.StartsWith("OST_GbXML", StringComparison.OrdinalIgnoreCase))
            return false;

        // 6) Hard exclude: systems/connectivity (not visible as 3D solids by default)
        if (name.Contains("Connector", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Circuit", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("RoutingPreferences", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("GraphicalWarning", StringComparison.OrdinalIgnoreCase))
            return false;

        // 7) Hard exclude: “layer/material subdivision” subcategories (not standalone geometry)
        if (name.Contains("Finish", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Substrate", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Structure", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Membrane", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("SurfacePattern", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Layers", StringComparison.OrdinalIgnoreCase) ||
            bic == BuiltInCategory.OST_WallCoreLayer ||
            bic == BuiltInCategory.OST_WallNonCoreLayer ||
            bic == BuiltInCategory.OST_FloorLayers ||
            bic == BuiltInCategory.OST_WallLayers)
            return false;

        // 8) Hard exclude: view/sheet containers
        if (bic == BuiltInCategory.OST_Views ||
            bic == BuiltInCategory.OST_Viewports ||
            bic == BuiltInCategory.OST_ViewportLabel ||
            bic == BuiltInCategory.OST_Sheets ||
            bic == BuiltInCategory.OST_TitleBlocks ||
            bic == BuiltInCategory.OST_Schedules ||
            name.Contains("Schedule", StringComparison.OrdinalIgnoreCase))
            return false;

        // 9) Hard exclude: sun/camera presentation aides (non-model)
        if (name.Contains("Sun", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Compass", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Analemma", StringComparison.OrdinalIgnoreCase) ||
            bic == BuiltInCategory.OST_Cameras ||
            bic == BuiltInCategory.OST_Camera_Lines ||
            bic == BuiltInCategory.OST_SectionBox)
            return false;

        // Default: conservative => false
        return true;
    }
    
    /// <summary>
    /// A list of all the built in categories within Revit.
    /// </summary>
    public enum BuiltInCategory : long
    {
        OST_StackedWalls_Obsolete_IdInWrongRange = -20034100L,
        OST_MassTags_Obsolete_IdInWrongRange = -20034005L,
        OST_MassSurface_Obsolete_IdInWrongRange = -20034004L,
        OST_MassFloor_Obsolete_IdInWrongRange = -20034003L,
        OST_Mass_Obsolete_IdInWrongRange = -20034000L,
        OST_WallRefPlanes_Obsolete_IdInWrongRange = -20000896L,
        OST_StickSymbols_Obsolete_IdInWrongRange = -20000828L,
        OST_RemovedGridSeg_Obsolete_IdInWrongRange = -20000827L,
        OST_PointClouds = -2010001L,
        OST_AnalyticalPanelLocalCoordSys = -2009667L,
        OST_AnalyticalMemberLocalCoordSys = -2009666L,
        OST_AnalyticalOpening = -2009665L,
        OST_AnalyticalPanel = -2009664L,
        OST_AnalyticalMemberTags = -2009663L,
        OST_AnalyticalMember = -2009662L,
        OST_AssemblyOrigin_Lines = -2009661L,
        OST_AssemblyOrigin_Planes = -2009660L,
        OST_AssemblyOrigin_Points = -2009659L,
        OST_AssemblyOrigin = -2009658L,
        OST_LinksAnalytical = -2009657L,
        OST_FoundationSlabAnalyticalTags = -2009656L,
        OST_WallFoundationAnalyticalTags = -2009655L,
        OST_IsolatedFoundationAnalyticalTags = -2009654L,
        OST_WallAnalyticalTags = -2009653L,
        OST_FloorAnalyticalTags = -2009652L,
        OST_ColumnAnalyticalTags = -2009651L,
        OST_BraceAnalyticalTags = -2009650L,
        OST_BeamAnalyticalTags = -2009649L,
        OST_AnalyticalNodes_Lines = -2009648L,
        OST_AnalyticalNodes_Planes = -2009647L,
        OST_AnalyticalNodes_Points = -2009646L,
        OST_AnalyticalNodes = -2009645L,
        OST_RigidLinksAnalytical = -2009644L,
        OST_FoundationSlabAnalytical = -2009643L,
        OST_WallFoundationAnalytical = -2009642L,
        OST_IsolatedFoundationAnalytical = -2009641L,
        OST_WallAnalytical = -2009640L,
        OST_FloorAnalytical = -2009639L,
        OST_ColumnEndSegment = -2009638L,
        OST_ColumnStartSegment = -2009637L,
        OST_ColumnAnalytical = -2009636L,
        OST_BraceEndSegment = -2009635L,
        OST_BraceStartSegment = -2009634L,
        OST_BraceAnalytical = -2009633L,
        OST_BeamEndSegment = -2009632L,
        OST_BeamStartSegment = -2009631L,
        OST_BeamAnalytical = -2009630L,
        OST_CompassSecondaryMonth = -2009624L,
        OST_CompassPrimaryMonth = -2009623L,
        OST_CompassSectionFilled = -2009622L,
        OST_LightLine = -2009621L,
        OST_MultiSurface = -2009620L,
        OST_SunSurface = -2009619L,
        OST_Analemma = -2009618L,
        OST_SunsetText = -2009617L,
        OST_CompassSection = -2009616L,
        OST_CompassOuter = -2009615L,
        OST_SunriseText = -2009614L,
        OST_CompassInner = -2009613L,
        OST_SunPath2 = -2009612L,
        OST_SunPath1 = -2009611L,
        OST_Sun = -2009610L,
        OST_SunStudy = -2009609L,
        OST_StructuralTrussStickSymbols = -2009608L,
        OST_StructuralTrussHiddenLines = -2009607L,
        OST_TrussChord = -2009606L,
        OST_TrussWeb = -2009605L,
        OST_TrussBottomChordCurve = -2009604L,
        OST_TrussTopChordCurve = -2009603L,
        OST_TrussVertWebCurve = -2009602L,
        OST_TrussDiagWebCurve = -2009601L,
        OST_Truss = -2009600L,
        OST_PlumbingEquipmentHiddenLines = -2009551L,
        OST_MechanicalControlDevicesHiddenLines = -2009550L,
        OST_RailingSystemTransitionHiddenLines_Deprecated = -2009549L,
        OST_RailingSystemTerminationHiddenLines_Deprecated = -2009548L,
        OST_RailingSystemRailHiddenLines_Deprecated = -2009547L,
        OST_RailingSystemTopRailHiddenLines_Deprecated = -2009546L,
        OST_RailingSystemHandRailBracketHiddenLines_Deprecated = -2009545L,
        OST_RailingSystemHandRailHiddenLines_Deprecated = -2009544L,
        OST_RailingSystemPanelBracketHiddenLines_Deprecated = -2009543L,
        OST_RailingSystemPanelHiddenLines_Deprecated = -2009542L,
        OST_RailingSystemBalusterHiddenLines_Deprecated = -2009541L,
        OST_RailingSystemPostHiddenLines_Deprecated = -2009540L,
        OST_RailingSystemSegmentHiddenLines_Deprecated = -2009539L,
        OST_RailingSystemHiddenLines_Deprecated = -2009538L,
        OST_StairStringer2012HiddenLines_Deprecated = -2009537L,
        OST_StairTread2012HiddenLines_Deprecated = -2009536L,
        OST_StairLanding2012HiddenLines_Deprecated = -2009535L,
        OST_StairRun2012HiddenLines_Deprecated = -2009534L,
        OST_Stairs2012HiddenLines_Deprecated = -2009533L,
        OST_MassHiddenLines = -2009532L,
        OST_CurtaSystemHiddenLines = -2009531L,
        OST_OBSOLETE_ElemArrayHiddenLines = -2009530L,
        OST_EntourageHiddenLines = -2009529L,
        OST_PlantingHiddenLines = -2009528L,
        OST_SpecialityEquipmentHiddenLines = -2009527L,
        OST_TopographyHiddenLines = -2009526L,
        OST_StructuralFramingSystemHiddenLines_Obsolete = -2009525L,
        OST_SiteHiddenLines = -2009524L,
        OST_RoadsHiddenLines = -2009523L,
        OST_ParkingHiddenLines = -2009522L,
        OST_PlumbingFixturesHiddenLines = -2009521L,
        OST_MechanicalEquipmentHiddenLines = -2009520L,
        OST_LightingFixturesHiddenLines = -2009519L,
        OST_FurnitureSystemsHiddenLines = -2009518L,
        OST_ElectricalFixturesHiddenLines = -2009517L,
        OST_ElectricalEquipmentHiddenLines = -2009516L,
        OST_CaseworkHiddenLines = -2009515L,
        OST_DetailComponentsHiddenLines = -2009514L,
        OST_ShaftOpeningHiddenLines = -2009513L,
        OST_GenericModelHiddenLines = -2009512L,
        OST_CurtainWallMullionsHiddenLines = -2009511L,
        OST_CurtainWallPanelsHiddenLines = -2009510L,
        OST_RampsHiddenLines = -2009509L,
        OST_StairsRailingHiddenLines = -2009508L,
        OST_StairsHiddenLines = -2009507L,
        OST_ColumnsHiddenLines = -2009506L,
        OST_FurnitureHiddenLines = -2009505L,
        OST_LinesHiddenLines = -2009504L,
        OST_CeilingsHiddenLines = -2009503L,
        OST_RoofsHiddenLines = -2009502L,
        OST_DoorsHiddenLines = -2009501L,
        OST_WindowsHiddenLines = -2009500L,
        OST_StructConnectionProfilesTags = -2009064L,
        OST_StructConnectionHoleTags = -2009063L,
        OST_CouplerHiddenLines = -2009062L,
        OST_CouplerTags = -2009061L,
        OST_Coupler = -2009060L,
        OST_StructConnectionWeldTags = -2009059L,
        OST_StructConnectionShearStudTags = -2009058L,
        OST_StructConnectionAnchorTags = -2009057L,
        OST_StructConnectionBoltTags = -2009056L,
        OST_StructConnectionPlateTags = -2009055L,
        OST_RebarHiddenLines = -2009050L,
        OST_StructSubConnections = -2009049L,
        OST_SteelElementStale = -2009048L,
        OST_StructConnectionModifiers = -2009047L,
        OST_StructConnectionWelds = -2009046L,
        OST_StructConnectionHoles = -2009045L,
        OST_StructConnectionShearStuds = -2009044L,
        OST_StructConnectionNobleWarning = -2009043L,
        OST_StructConnectionOthers = -2009042L,
        OST_StructConnectionBolts = -2009041L,
        OST_StructConnectionTags = -2009040L,
        OST_StructConnectionAnchors = -2009039L,
        OST_StructConnectionPlates = -2009038L,
        OST_StructConnectionProfiles = -2009037L,
        OST_StructConnectionReference = -2009036L,
        OST_StructConnectionFailed = -2009035L,
        OST_StructConnectionStale = -2009034L,
        OST_StructConnectionSymbol = -2009033L,
        OST_StructConnectionHiddenLines = -2009032L,
        OST_StructWeldLines = -2009031L,
        OST_StructConnections = -2009030L,
        OST_FabricAreaBoundary = -2009029L,
        OST_FabricReinSpanSymbol = -2009028L,
        OST_FabricReinforcementWire = -2009027L,
        OST_FabricReinforcementBoundary = -2009026L,
        OST_RebarSetToggle = -2009025L,
        OST_FabricAreaTags = -2009023L,
        OST_FabricReinforcementTags = -2009022L,
        OST_AreaReinTags = -2009021L,
        OST_RebarTags = -2009020L,
        OST_FabricAreaSketchSheetsLines = -2009019L,
        OST_FabricAreaSketchEnvelopeLines = -2009018L,
        OST_FabricAreas = -2009017L,
        OST_FabricReinforcement = -2009016L,
        OST_RebarCover = -2009015L,
        OST_CoverType = -2009014L,
        OST_RebarShape = -2009013L,
        OST_PathReinBoundary = -2009012L,
        OST_PathReinTags = -2009011L,
        OST_PathReinSpanSymbol = -2009010L,
        OST_PathRein = -2009009L,
        OST_Cage = -2009008L,
        OST_AreaReinXVisibility = -2009007L,
        OST_AreaReinBoundary = -2009006L,
        OST_AreaReinSpanSymbol = -2009005L,
        OST_AreaReinSketchOverride = -2009004L,
        OST_AreaRein = -2009003L,
        OST_RebarLines = -2009002L,
        OST_RebarSketchLines = -2009001L,
        OST_Rebar = -2009000L,
        OST_MEPAncillaryFramingTags = -2008236L,
        OST_PlumbingEquipmentTags = -2008235L,
        OST_PlumbingEquipment = -2008234L,
        OST_MechanicalControlDeviceTags = -2008233L,
        OST_MechanicalControlDevices = -2008232L,
        OST_MEPAncillaryFraming = -2008231L,
        OST_MEPAncillaries_Obsolete = -2008230L,
        OST_FabricationDuctworkStiffenerTags = -2008229L,
        OST_FabricationDuctworkStiffeners = -2008228L,
        OST_ELECTRICAL_AreaBasedLoads_Reference_Visibility = -2008227L,
        OST_ELECTRICAL_AreaBasedLoads_InteriorFill_Visibility = -2008226L,
        OST_ELECTRICAL_AreaBasedLoads_ColorFill_Obsolete = -2008225L,
        OST_ELECTRICAL_AreaBasedLoads_Reference = -2008224L,
        OST_ELECTRICAL_AreaBasedLoads_InteriorFill = -2008223L,
        OST_ELECTRICAL_AreaBasedLoads_Boundary = -2008222L,
        OST_FabricationPipeworkInsulation = -2008221L,
        OST_FabricationDuctworkLining = -2008220L,
        OST_FabricationContainmentDrop = -2008219L,
        OST_FabricationContainmentRise = -2008218L,
        OST_FabricationPipeworkDrop = -2008217L,
        OST_FabricationPipeworkRise = -2008216L,
        OST_FabricationContainmentSymbology = -2008215L,
        OST_FabricationContainmentCenterLine = -2008214L,
        OST_FabricationContainmentTags = -2008213L,
        OST_FabricationContainment = -2008212L,
        OST_FabricationPipeworkSymbology = -2008211L,
        OST_FabricationPipeworkCenterLine = -2008210L,
        OST_FabricationPipeworkTags = -2008209L,
        OST_FabricationPipework = -2008208L,
        OST_FabricationDuctworkSymbology = -2008207L,
        OST_FabricationDuctworkDrop = -2008206L,
        OST_FabricationDuctworkRise = -2008205L,
        OST_FabricationHangerTags = -2008204L,
        OST_FabricationHangers = -2008203L,
        OST_OBSOLETE_FabricationPartsTmpGraphicDropDrag = -2008202L,
        OST_FabricationPartsTmpGraphicDrag = -2008201L,
        OST_OBSOLETE_FabricationPartsTmpGraphicDrop = -2008200L,
        OST_FabricationPartsTmpGraphicEnd = -2008199L,
        OST_FabricationDuctworkInsulation = -2008198L,
        OST_LayoutNodes = -2008197L,
        OST_FabricationDuctworkCenterLine = -2008196L,
        OST_FabricationServiceElements = -2008195L,
        OST_FabricationDuctworkTags = -2008194L,
        OST_FabricationDuctwork = -2008193L,
        OST_LayoutPathBase_Pipings = -2008192L,
        OST_NumberingSchemas = -2008191L,
        OST_DivisionRules = -2008190L,
        OST_gbXML_Shade = -2008187L,
        OST_AnalyticSurfaces = -2008186L,
        OST_AnalyticSpaces = -2008185L,
        OST_gbXML_OpeningAir = -2008184L,
        OST_gbXML_NonSlidingDoor = -2008183L,
        OST_gbXML_SlidingDoor = -2008182L,
        OST_gbXML_OperableSkylight = -2008181L,
        OST_gbXML_FixedSkylight = -2008180L,
        OST_gbXML_OperableWindow = -2008179L,
        OST_gbXML_FixedWindow = -2008178L,
        OST_gbXML_UndergroundCeiling = -2008177L,
        OST_gbXML_UndergroundSlab = -2008176L,
        OST_gbXML_UndergroundWall = -2008175L,
        OST_gbXML_SurfaceAir = -2008174L,
        OST_gbXML_Ceiling = -2008173L,
        OST_gbXML_InteriorFloor = -2008172L,
        OST_gbXML_InteriorWall = -2008171L,
        OST_gbXML_SlabOnGrade = -2008170L,
        OST_gbXML_RaisedFloor = -2008169L,
        OST_gbXML_Roof = -2008168L,
        OST_gbXML_ExteriorWall = -2008167L,
        OST_DivisionProfile = -2008165L,
        OST_SplitterProfile = -2008164L,
        OST_PipeSegments = -2008163L,
        OST_GraphicalWarning_OpenConnector = -2008162L,
        OST_PlaceHolderPipes = -2008161L,
        OST_PlaceHolderDucts = -2008160L,
        OST_PipingSystem_Reference_Visibility = -2008159L,
        OST_PipingSystem_Reference = -2008158L,
        OST_DuctSystem_Reference_Visibility = -2008157L,
        OST_DuctSystem_Reference = -2008156L,
        OST_PipeInsulationsTags = -2008155L,
        OST_DuctLiningsTags = -2008154L,
        OST_DuctInsulationsTags = -2008153L,
        OST_ElectricalInternalCircuits = -2008152L,
        OST_PanelScheduleGraphics = -2008151L,
        OST_CableTrayRun = -2008150L,
        OST_ConduitRun = -2008149L,
        OST_ParamElemElectricalLoadClassification = -2008148L,
        OST_DataPanelScheduleTemplates = -2008147L,
        OST_SwitchboardScheduleTemplates = -2008146L,
        OST_BranchPanelScheduleTemplates = -2008145L,
        OST_ConduitStandards = -2008144L,
        OST_ElectricalLoadClassifications = -2008143L,
        OST_ElectricalDemandFactorDefinitions = -2008142L,
        OST_ConduitFittingCenterLine = -2008141L,
        OST_CableTrayFittingCenterLine = -2008140L,
        OST_ConduitCenterLine = -2008139L,
        OST_ConduitDrop = -2008138L,
        OST_ConduitRiseDrop = -2008137L,
        OST_CableTrayCenterLine = -2008136L,
        OST_CableTrayDrop = -2008135L,
        OST_CableTrayRiseDrop = -2008134L,
        OST_ConduitTags = -2008133L,
        OST_Conduit = -2008132L,
        OST_CableTrayTags = -2008131L,
        OST_CableTray = -2008130L,
        OST_ConduitFittingTags = -2008129L,
        OST_ConduitFitting = -2008128L,
        OST_CableTrayFittingTags = -2008127L,
        OST_CableTrayFitting = -2008126L,
        OST_RoutingPreferences = -2008125L,
        OST_DuctLinings = -2008124L,
        OST_DuctInsulations = -2008123L,
        OST_PipeInsulations = -2008122L,
        OST_HVAC_Load_Schedules = -2008121L,
        OST_HVAC_Load_Building_Types = -2008120L,
        OST_HVAC_Load_Space_Types = -2008119L,
        OST_HVAC_Zones_Reference_Visibility = -2008118L,
        OST_HVAC_Zones_InteriorFill_Visibility = -2008117L,
        OST_HVAC_Zones_ColorFill = -2008116L,
        OST_ZoneTags = -2008115L,
        OST_LayoutPath_Bases = -2008114L,
        OST_WireTemperatureRatings = -2008113L,
        OST_WireInsulations = -2008112L,
        OST_WireMaterials = -2008111L,
        OST_HVAC_Zones_Reference = -2008110L,
        OST_HVAC_Zones_InteriorFill = -2008109L,
        OST_HVAC_Zones_Boundary = -2008108L,
        OST_HVAC_Zones = -2008107L,
        OST_Fluids = -2008106L,
        OST_PipeSchedules = -2008105L,
        OST_PipeMaterials = -2008104L,
        OST_PipeConnections = -2008103L,
        OST_EAConstructions = -2008102L,
        OST_SwitchSystem = -2008101L,
        OST_SprinklerTags = -2008100L,
        OST_Sprinklers = -2008099L,
        OST_RouteCurveBranch = -2008098L,
        OST_RouteCurveMain = -2008097L,
        OST_RouteCurve = -2008096L,
        OST_GbXML_Opening = -2008095L,
        OST_GbXML_SType_Underground = -2008094L,
        OST_GbXML_SType_Shade = -2008093L,
        OST_GbXML_SType_Exterior = -2008092L,
        OST_GbXML_SType_Interior = -2008091L,
        OST_GbXMLFaces = -2008090L,
        OST_WireHomeRunArrows = -2008089L,
        OST_LightingDeviceTags = -2008088L,
        OST_LightingDevices = -2008087L,
        OST_FireAlarmDeviceTags = -2008086L,
        OST_FireAlarmDevices = -2008085L,
        OST_DataDeviceTags = -2008084L,
        OST_DataDevices = -2008083L,
        OST_CommunicationDeviceTags = -2008082L,
        OST_CommunicationDevices = -2008081L,
        OST_SecurityDeviceTags = -2008080L,
        OST_SecurityDevices = -2008079L,
        OST_NurseCallDeviceTags = -2008078L,
        OST_NurseCallDevices = -2008077L,
        OST_TelephoneDeviceTags = -2008076L,
        OST_TelephoneDevices = -2008075L,
        OST_WireTickMarks = -2008074L,
        OST_PipeFittingInsulation = -2008073L,
        OST_PipeFittingCenterLine = -2008072L,
        OST_FlexPipeCurvesInsulation = -2008071L,
        OST_PipeCurvesInsulation = -2008070L,
        OST_PipeCurvesDrop = -2008069L,
        OST_DuctFittingLining = -2008068L,
        OST_DuctFittingInsulation = -2008067L,
        OST_DuctFittingCenterLine = -2008066L,
        OST_FlexDuctCurvesInsulation = -2008065L,
        OST_DuctCurvesLining = -2008064L,
        OST_DuctCurvesInsulation = -2008063L,
        OST_DuctCurvesDrop = -2008062L,
        OST_DuctFittingTags = -2008061L,
        OST_PipeFittingTags = -2008060L,
        OST_PipeColorFills = -2008059L,
        OST_PipeColorFillLegends = -2008058L,
        OST_WireTags = -2008057L,
        OST_PipeAccessoryTags = -2008056L,
        OST_PipeAccessory = -2008055L,
        OST_PipeCurvesRiseDrop = -2008054L,
        OST_FlexPipeCurvesPattern = -2008053L,
        OST_FlexPipeCurvesContour = -2008052L,
        OST_FlexPipeCurvesCenterLine = -2008051L,
        OST_FlexPipeCurves = -2008050L,
        OST_PipeFitting = -2008049L,
        OST_FlexPipeTags = -2008048L,
        OST_PipeTags = -2008047L,
        OST_PipeCurvesContour = -2008046L,
        OST_PipeCurvesCenterLine = -2008045L,
        OST_PipeCurves = -2008044L,
        OST_PipingSystem = -2008043L,
        OST_ElectricalDemandFactor = -2008042L,
        OST_ElecDistributionSys = -2008041L,
        OST_ElectricalVoltage = -2008040L,
        OST_Wire = -2008039L,
        OST_ElectricalCircuitTags = -2008038L,
        OST_ElectricalCircuit = -2008037L,
        OST_DuctCurvesRiseDrop = -2008036L,
        OST_FlexDuctCurvesPattern = -2008023L,
        OST_FlexDuctCurvesContour = -2008022L,
        OST_FlexDuctCurvesCenterLine = -2008021L,
        OST_FlexDuctCurves = -2008020L,
        OST_DuctAccessoryTags = -2008017L,
        OST_DuctAccessory = -2008016L,
        OST_DuctSystem = -2008015L,
        OST_DuctTerminalTags = -2008014L,
        OST_DuctTerminal = -2008013L,
        OST_DuctFitting = -2008010L,
        OST_DuctColorFills = -2008005L,
        OST_FlexDuctTags = -2008004L,
        OST_DuctTags = -2008003L,
        OST_DuctCurvesContour = -2008002L,
        OST_DuctCurvesCenterLine = -2008001L,
        OST_DuctCurves = -2008000L,
        OST_DuctColorFillLegends = -2007004L,
        OST_ConnectorElemZAxis = -2007003L,
        OST_ConnectorElemYAxis = -2007002L,
        OST_ConnectorElemXAxis = -2007001L,
        OST_ConnectorElem = -2007000L,
        OST_VibrationManagementTags = -2006282L,
        OST_BridgeFramingTrussTags = -2006281L,
        OST_BridgeFramingDiaphragmTags = -2006279L,
        OST_BridgeFramingCrossBracingTags = -2006278L,
        OST_StructuralTendonTags = -2006276L,
        OST_StructuralTendonHiddenLines = -2006275L,
        OST_StructuralTendons = -2006274L,
        OST_ExpansionJointTags = -2006273L,
        OST_ExpansionJointHiddenLines = -2006272L,
        OST_ExpansionJoints = -2006271L,
        OST_VibrationIsolatorTags = -2006266L,
        OST_VibrationIsolators = -2006265L,
        OST_VibrationDamperTags = -2006264L,
        OST_VibrationDampers = -2006263L,
        OST_VibrationManagementHiddenLines = -2006262L,
        OST_VibrationManagement = -2006261L,
        OST_BridgeFramingTrusses = -2006248L,
        OST_BridgeFramingDiaphragms = -2006246L,
        OST_BridgeFramingCrossBracing = -2006245L,
        OST_BridgeFramingTags = -2006243L,
        OST_BridgeFramingHiddenLines = -2006242L,
        OST_BridgeFraming = -2006241L,
        OST_PierWallTags = -2006230L,
        OST_PierWalls = -2006229L,
        OST_PierPileTags = -2006226L,
        OST_PierPiles = -2006225L,
        OST_PierColumnTags = -2006222L,
        OST_PierColumns = -2006221L,
        OST_PierCapTags = -2006220L,
        OST_PierCaps = -2006219L,
        OST_ApproachSlabTags = -2006211L,
        OST_AbutmentWallTags = -2006210L,
        OST_AbutmentPileTags = -2006209L,
        OST_AbutmentFoundationTags = -2006208L,
        OST_ApproachSlabs = -2006205L,
        OST_AbutmentWalls = -2006204L,
        OST_AbutmentPiles = -2006203L,
        OST_AbutmentFoundations = -2006202L,
        OST_BridgeBearingTags = -2006178L,
        OST_BridgeGirderTags = -2006177L,
        OST_BridgeFoundationTags = -2006176L,
        OST_BridgeDeckTags = -2006175L,
        OST_BridgeArchTags = -2006174L,
        OST_BridgeCableTags = -2006173L,
        OST_BridgeTowerTags = -2006172L,
        OST_BridgePierTags = -2006171L,
        OST_BridgeAbutmentTags = -2006170L,
        OST_BridgeBearingHiddenLines = -2006158L,
        OST_BridgeGirderHiddenLines2021_Deprecated = -2006157L,
        OST_BridgeFoundationHiddenLines2021_Deprecated = -2006156L,
        OST_BridgeDeckHiddenLines = -2006155L,
        OST_BridgeArchHiddenLines2021_Deprecated = -2006154L,
        OST_BridgeCableHiddenLines2021_Deprecated = -2006153L,
        OST_BridgeTowerHiddenLines2021_Deprecated = -2006152L,
        OST_BridgePierHiddenLines = -2006151L,
        OST_BridgeAbutmentHiddenLines = -2006150L,
        OST_BridgeBearings = -2006138L,
        OST_BridgeGirders = -2006137L,
        OST_BridgeFoundations = -2006136L,
        OST_BridgeDecks = -2006135L,
        OST_BridgeArches = -2006134L,
        OST_BridgeCables = -2006133L,
        OST_BridgeTowers = -2006132L,
        OST_BridgePiers = -2006131L,
        OST_BridgeAbutments = -2006130L,
        OST_DesignOptions = -2006114L,
        OST_DesignOptionSets = -2006112L,
        OST_StructuralBracePlanReps = -2006110L,
        OST_StructConnectionSymbols = -2006100L,
        OST_StructuralAnnotations = -2006090L,
        OST_RevisionCloudTags = -2006080L,
        OST_RevisionNumberingSequences = -2006071L,
        OST_Revisions = -2006070L,
        OST_RevisionClouds = -2006060L,
        OST_EditCutProfile = -2006050L,
        OST_ElevationMarks = -2006045L,
        OST_GridHeads = -2006040L,
        OST_LevelHeads = -2006020L,
        OST_DecalType = -2006002L,
        OST_DecalElement = -2006001L,
        OST_VolumeOfInterest = -2006000L,
        OST_BoundaryConditions = -2005301L,
        OST_InternalAreaLoadTags = -2005255L,
        OST_InternalLineLoadTags = -2005254L,
        OST_InternalPointLoadTags = -2005253L,
        OST_AreaLoadTags = -2005252L,
        OST_LineLoadTags = -2005251L,
        OST_PointLoadTags = -2005250L,
        OST_LoadCasesSeismic = -2005218L,
        OST_LoadCasesTemperature = -2005217L,
        OST_LoadCasesAccidental = -2005216L,
        OST_LoadCasesRoofLive = -2005215L,
        OST_LoadCasesSnow = -2005214L,
        OST_LoadCasesWind = -2005213L,
        OST_LoadCasesLive = -2005212L,
        OST_LoadCasesDead = -2005211L,
        OST_LoadCases = -2005210L,
        OST_InternalAreaLoads = -2005207L,
        OST_InternalLineLoads = -2005206L,
        OST_InternalPointLoads = -2005205L,
        OST_InternalLoads = -2005204L,
        OST_AreaLoads = -2005203L,
        OST_LineLoads = -2005202L,
        OST_PointLoads = -2005201L,
        OST_Loads = -2005200L,
        OST_BeamSystemTags = -2005130L,
        OST_FootingSpanDirectionSymbol = -2005111L,
        OST_SpanDirectionSymbol = -2005110L,
        OST_SpotSlopesSymbols = -2005102L,
        OST_SpotCoordinateSymbols = -2005101L,
        OST_SpotElevSymbols = -2005100L,
        OST_MultiLeaderTag = -2005033L,
        OST_CurtainWallMullionTags = -2005032L,
        OST_StructuralConnectionHandlerTags_Deprecated = -2005031L,
        OST_TrussTags = -2005030L,
        OST_KeynoteTags = -2005029L,
        OST_DetailComponentTags = -2005028L,
        OST_MaterialTags = -2005027L,
        OST_FloorTags = -2005026L,
        OST_CurtaSystemTags = -2005025L,
        OST_HostFinTags = -2005024L,
        OST_StairsTags = -2005023L,
        OST_MultiCategoryTags = -2005022L,
        OST_PlantingTags = -2005021L,
        OST_AreaTags = -2005020L,
        OST_StructuralFoundationTags = -2005019L,
        OST_StructuralColumnTags = -2005018L,
        OST_ParkingTags = -2005017L,
        OST_SiteTags = -2005016L,
        OST_StructuralFramingTags = -2005015L,
        OST_SpecialityEquipmentTags = -2005014L,
        OST_GenericModelTags = -2005013L,
        OST_CurtainWallPanelTags = -2005012L,
        OST_WallTags = -2005011L,
        OST_PlumbingFixtureTags = -2005010L,
        OST_MechanicalEquipmentTags = -2005009L,
        OST_LightingFixtureTags = -2005008L,
        OST_FurnitureSystemTags = -2005007L,
        OST_FurnitureTags = -2005006L,
        OST_ElectricalFixtureTags = -2005004L,
        OST_ElectricalEquipmentTags = -2005003L,
        OST_CeilingTags = -2005002L,
        OST_CaseworkTags = -2005001L,
        OST_Tags = -2005000L,
        OST_MEPSpaceColorFill = -2003605L,
        OST_MEPSpaceReference = -2003604L,
        OST_MEPSpaceInteriorFill = -2003603L,
        OST_MEPSpaceReferenceVisibility = -2003602L,
        OST_MEPSpaceInteriorFillVisibility = -2003601L,
        OST_MEPSpaces = -2003600L,
        OST_StackedWalls = -2003500L,
        OST_MassGlazingAll = -2003423L,
        OST_MassFloorsAll = -2003422L,
        OST_MassWallsAll = -2003421L,
        OST_MassExteriorWallUnderground = -2003420L,
        OST_MassSlab = -2003419L,
        OST_MassShade = -2003418L,
        OST_MassOpening = -2003417L,
        OST_MassSkylights = -2003416L,
        OST_MassGlazing = -2003415L,
        OST_MassRoof = -2003414L,
        OST_MassExteriorWall = -2003413L,
        OST_MassInteriorWall = -2003412L,
        OST_MassZone = -2003411L,
        OST_MassAreaFaceTags = -2003410L,
        OST_HostTemplate = -2003409L,
        OST_MassFaceSplitter = -2003408L,
        OST_MassCutter = -2003407L,
        OST_ZoningEnvelope = -2003406L,
        OST_MassTags = -2003405L,
        OST_MassForm = -2003404L,
        OST_MassFloor = -2003403L,
        OST_Mass = -2003400L,
        OST_DividedSurface_DiscardedDivisionLines = -2003333L,
        OST_DividedSurfaceBelt = -2003332L,
        OST_TilePatterns = -2003331L,
        OST_AlwaysExcludedInAllViews = -2003330L,
        OST_DividedSurface_TransparentFace = -2003329L,
        OST_DividedSurface_PreDividedSurface = -2003328L,
        OST_DividedSurface_PatternFill = -2003327L,
        OST_DividedSurface_PatternLines = -2003326L,
        OST_DividedSurface_Gridlines = -2003325L,
        OST_DividedSurface_Nodes = -2003324L,
        OST_DividedSurface = -2003323L,
        OST_RepeatingDetailLines = -2003321L,
        OST_RampsDownArrow = -2003308L,
        OST_RampsUpArrow = -2003307L,
        OST_RampsDownText = -2003306L,
        OST_RampsUpText = -2003305L,
        OST_RampsStringerAboveCut = -2003304L,
        OST_RampsStringer = -2003303L,
        OST_RampsAboveCut = -2003302L,
        OST_RampsIncomplete = -2003301L,
        OST_TrussDummy = -2003300L,
        OST_ZoneSchemes = -2003225L,
        OST_AreaSchemes = -2003201L,
        OST_Areas = -2003200L,
        OST_ProjectInformation = -2003101L,
        OST_Sheets = -2003100L,
        OST_ProfileFamilies = -2003000L,
        OST_DetailComponents = -2002000L,
        OST_RoofSoffit = -2001393L,
        OST_EdgeSlab = -2001392L,
        OST_Gutter = -2001391L,
        OST_Fascia = -2001390L,
        OST_Entourage = -2001370L,
        OST_Planting = -2001360L,
        OST_Blocks = -2001359L,
        OST_StructuralStiffenerHiddenLines = -2001358L,
        OST_StructuralColumnLocationLine = -2001357L,
        OST_StructuralFramingLocationLine = -2001356L,
        OST_StructuralStiffenerTags = -2001355L,
        OST_StructuralStiffener = -2001354L,
        OST_FootingAnalyticalGeometry = -2001353L,
        OST_RvtLinks = -2001352L,
        OST_Automatic = -2001351L,
        OST_SpecialityEquipment = -2001350L,
        OST_ColumnAnalyticalRigidLinks = -2001344L,
        OST_SecondaryTopographyContours = -2001343L,
        OST_TopographyContours = -2001342L,
        OST_TopographySurface = -2001341L,
        OST_Topography = -2001340L,
        OST_TopographyLink = -2001339L,
        OST_StructuralTruss = -2001336L,
        OST_StructuralColumnStickSymbols = -2001335L,
        OST_HiddenStructuralColumnLines = -2001334L,
        OST_AnalyticalRigidLinks = -2001333L,
        OST_ColumnAnalyticalGeometry = -2001332L,
        OST_FramingAnalyticalGeometry = -2001331L,
        OST_StructuralColumns = -2001330L,
        OST_HiddenStructuralFramingLines = -2001329L,
        OST_KickerBracing = -2001328L,
        OST_StructuralFramingSystem = -2001327L,
        OST_VerticalBracing = -2001326L,
        OST_HorizontalBracing = -2001325L,
        OST_Purlin = -2001324L,
        OST_Joist = -2001323L,
        OST_Girder = -2001322L,
        OST_StructuralFramingOther = -2001321L,
        OST_StructuralFraming = -2001320L,
        OST_HiddenStructuralFoundationLines = -2001302L,
        OST_StructuralFoundation = -2001300L,
        OST_LinkBasePoint = -2001276L,
        OST_BasePointAxisZ = -2001275L,
        OST_BasePointAxisY = -2001274L,
        OST_BasePointAxisX = -2001273L,
        OST_SharedBasePoint = -2001272L,
        OST_ProjectBasePoint = -2001271L,
        OST_SiteRegion = -2001270L,
        OST_SitePropertyLineSegmentTags = -2001269L,
        OST_SitePropertyLineSegment = -2001268L,
        OST_SitePropertyTags = -2001267L,
        OST_SitePointBoundary = -2001266L,
        OST_SiteProperty = -2001265L,
        OST_BuildingPad = -2001263L,
        OST_SitePoint = -2001262L,
        OST_SiteSurface = -2001261L,
        OST_Site = -2001260L,
        OST_Sewer = -2001240L,
        OST_RoadTags = -2001221L,
        OST_Roads = -2001220L,
        OST_Property = -2001200L,
        OST_Parking = -2001180L,
        OST_PlumbingFixtures = -2001160L,
        OST_MechanicalEquipment = -2001140L,
        OST_LightingFixtureSource = -2001121L,
        OST_LightingFixtures = -2001120L,
        OST_DuctAnalyticalSegmentTags = -2001116L,
        OST_DuctAnalyticalSegments = -2001115L,
        OST_PipeAnalyticalSegmentTags = -2001114L,
        OST_PipeAnalyticalSegments = -2001113L,
        OST_SheetCollections = -2001112L,
        OST_DuctFlowDirectionSymbols_Obsolete = -2001111L,
        OST_PipeFlowDirectionSymbols_Obsolete = -2001110L,
        OST_RebarSpliceType = -2001109L,
        OST_RebarSpliceLines = -2001108L,
        OST_DataExchanges = -2001107L,
        OST_FloorLayers = -2001106L,
        OST_WallLayers = -2001105L,
        OST_RebarBendingDetails = -2001104L,
        OST_ToposolidLinkTags = -2001103L,
        OST_ElectricalConnectorTags = -2001102L,
        OST_ElectricalConnector = -2001101L,
        OST_FurnitureSystems = -2001100L,
        OST_ElectricalLoadCase = -2001099L,
        OST_ElectricalLoadSet = -2001098L,
        OST_ToposolidLink = -2001097L,
        OST_ElectricalAnalyticalFeeder = -2001096L,
        OST_ToposolidOpening = -2001095L,
        OST_ToposolidTags = -2001094L,
        OST_ToposolidInsulation = -2001093L,
        OST_ToposolidSurfacePattern = -2001092L,
        OST_ToposolidFinish2 = -2001091L,
        OST_ToposolidFinish1 = -2001090L,
        OST_ToposolidSubstrate = -2001089L,
        OST_ToposolidStructure = -2001088L,
        OST_ToposolidMembrane = -2001087L,
        OST_ToposolidCutPattern = -2001086L,
        OST_ToposolidDefault = -2001085L,
        OST_ToposolidSplitLines = -2001084L,
        OST_ToposolidFoldingLines = -2001083L,
        OST_ToposolidSecondaryContours = -2001082L,
        OST_ToposolidContours = -2001081L,
        OST_ToposolidHiddenLines = -2001080L,
        OST_Toposolid = -2001079L,
        OST_ELECTRICAL_AreaBasedLoads_Tags = -2001078L,
        OST_ElectricalAnalyticalTransformer = -2001077L,
        OST_FloorsSplitLines = -2001076L,
        OST_AnalyticalMemberCrossSection = -2001075L,
        OST_RvtLinksTags = -2001074L,
        OST_ModelGroupTags = -2001073L,
        OST_WallSweepTags = -2001072L,
        OST_TopRailTags = -2001071L,
        OST_SlabEdgeTags = -2001070L,
        OST_RoofSoffitTags = -2001069L,
        OST_RampTags = -2001068L,
        OST_PadTags = -2001067L,
        OST_HandrailTags = -2001066L,
        OST_GutterTags = -2001065L,
        OST_EntourageTags = -2001064L,
        OST_ColumnTags = -2001063L,
        OST_FasciaTags = -2001062L,
        OST_SignageTags = -2001061L,
        OST_ElectricalFixtures = -2001060L,
        OST_SignageHiddenLines = -2001059L,
        OST_Signage = -2001058L,
        OST_AudioVisualDeviceTags = -2001057L,
        OST_AudioVisualDevicesHiddenLines = -2001056L,
        OST_AudioVisualDevices = -2001055L,
        OST_VerticalCirculationTags = -2001054L,
        OST_VerticalCirculationHiddenLines = -2001053L,
        OST_VerticalCirculation = -2001052L,
        OST_FireProtectionTags = -2001051L,
        OST_FireProtectionHiddenLines = -2001050L,
        OST_FireProtection = -2001049L,
        OST_MedicalEquipmentTags = -2001048L,
        OST_MedicalEquipmentHiddenLines = -2001047L,
        OST_MedicalEquipment = -2001046L,
        OST_FoodServiceEquipmentTags = -2001045L,
        OST_FoodServiceEquipmentHiddenLines = -2001044L,
        OST_FoodServiceEquipment = -2001043L,
        OST_TemporaryStructureTags = -2001042L,
        OST_TemporaryStructureHiddenLines = -2001041L,
        OST_ElectricalEquipment = -2001040L,
        OST_TemporaryStructure = -2001039L,
        OST_HardscapeTags = -2001038L,
        OST_HardscapeHiddenLines = -2001037L,
        OST_Hardscape = -2001036L,
        OST_WallCoreLayer = -2001035L,
        OST_WallNonCoreLayer = -2001034L,
        OST_MEPLoadAreaSeparationLines = -2001033L,
        OST_MEPLoadAreaReferenceVisibility = -2001031L,
        OST_MEPLoadAreaInteriorFillVisibility = -2001030L,
        OST_MEPLoadAreaReference = -2001029L,
        OST_MEPLoadAreaInteriorFill = -2001028L,
        OST_MEPLoadAreaColorFill = -2001027L,
        OST_ElectricalPowerSource = -2001026L,
        OST_MEPLoadAreaTags_OBSOLETE = -2001025L,
        OST_MEPLoadAreas = -2001024L,
        OST_MEPAnalyticalTransferSwitch = -2001023L,
        OST_OBSOLETE_MEPAnalyticalElectricalBranch = -2001022L,
        OST_MEPAnalyticalBus = -2001021L,
        OST_ElectricalLoadZoneInstance = -2001020L,
        OST_ElectricalLoadZoneType = -2001019L,
        OST_ElectricalZoneEquipment_Obsolete = -2001018L,
        OST_AlignmentStationLabels = -2001017L,
        OST_AlignmentStationLabelSets = -2001016L,
        OST_AlignmentsTags = -2001015L,
        OST_MinorStations_Deprecated = -2001014L,
        OST_MajorStations_Deprecated = -2001013L,
        OST_Alignments = -2001012L,
        OST_ElectricalCircuitNaming = -2001011L,
        OST_ZoneEquipment = -2001010L,
        OST_MEPAnalyticalWaterLoop = -2001009L,
        OST_MEPAnalyticalAirLoop = -2001008L,
        OST_MEPSystemZoneTags = -2001007L,
        OST_MEPSystemZoneReferenceLinesVisibility = -2001006L,
        OST_MEPSystemZoneInteriorFillVisibility = -2001005L,
        OST_MEPSystemZoneReferenceLines = -2001004L,
        OST_MEPSystemZoneInteriorFill = -2001003L,
        OST_MEPSystemZoneBoundary = -2001002L,
        OST_MEPSystemZone = -2001001L,
        OST_Casework = -2001000L,
        OST_ArcWallRectOpening = -2000999L,
        OST_DormerOpeningIncomplete = -2000998L,
        OST_SWallRectOpening = -2000997L,
        OST_ShaftOpening = -2000996L,
        OST_StructuralFramingOpening = -2000995L,
        OST_ColumnOpening = -2000994L,
        OST_RiseDropSymbols = -2000989L,
        OST_PipeHydronicSeparationSymbols = -2000988L,
        OST_MechanicalEquipmentSetBoundaryLines = -2000987L,
        OST_MechanicalEquipmentSetTags = -2000986L,
        OST_MechanicalEquipmentSet = -2000985L,
        OST_AnalyticalPipeConnectionLineSymbol = -2000984L,
        OST_AnalyticalPipeConnections = -2000983L,
        OST_Coordination_Model = -2000982L,
        OST_MultistoryStairs = -2000980L,
        OST_HiddenStructuralConnectionLines_Deprecated = -2000979L,
        OST_StructuralConnectionHandler_Deprecated = -2000978L,
        OST_CoordinateSystem = -2000977L,
        OST_FndSlabLocalCoordSys = -2000976L,
        OST_FloorLocalCoordSys = -2000975L,
        OST_WallLocalCoordSys = -2000974L,
        OST_BraceLocalCoordSys = -2000973L,
        OST_ColumnLocalCoordSys = -2000972L,
        OST_BeamLocalCoordSys = -2000971L,
        OST_MultiReferenceAnnotations = -2000970L,
        OST_DSR_LeaderTickMarkStyleId = -2000969L,
        OST_DSR_InteriorTickMarkStyleId = -2000968L,
        OST_DSR_ArrowHeadStyleId = -2000967L,
        OST_DSR_CenterlineTickMarkStyleId = -2000966L,
        OST_DSR_CenterlinePatternCatId = -2000965L,
        OST_DSR_DimStyleHeavyEndCategoryId = -2000964L,
        OST_DSR_DimStyleHeavyEndCatId = -2000963L,
        OST_DSR_DimStyleTickCategoryId = -2000962L,
        OST_DSR_LineAndTextAttrFontId = -2000961L,
        OST_DSR_LineAndTextAttrCategoryId = -2000960L,
        OST_AnalyticalOpeningTags = -2000958L,
        OST_AnalyticalPanelTags = -2000957L,
        OST_NodeAnalyticalTags = -2000956L,
        OST_LinkAnalyticalTags = -2000955L,
        OST_RailingRailPathExtensionLines = -2000954L,
        OST_RailingRailPathLines = -2000953L,
        OST_StairsSupports = -2000952L,
        OST_RailingHandRailAboveCut = -2000951L,
        OST_RailingTopRailAboveCut = -2000950L,
        OST_RailingTermination = -2000949L,
        OST_RailingSupport = -2000948L,
        OST_RailingHandRail = -2000947L,
        OST_RailingTopRail = -2000946L,
        OST_StairsSketchPathLines = -2000945L,
        OST_StairsTriserNumbers = -2000944L,
        OST_StairsTriserTags = -2000943L,
        OST_StairsSupportTags = -2000942L,
        OST_StairsLandingTags = -2000941L,
        OST_StairsRunTags = -2000940L,
        OST_StairsPathsAboveCut = -2000939L,
        OST_StairsPaths = -2000938L,
        OST_StairsRiserLinesAboveCut = -2000937L,
        OST_StairsRiserLines = -2000936L,
        OST_StairsOutlinesAboveCut = -2000935L,
        OST_StairsOutlines = -2000934L,
        OST_StairsNosingLinesAboveCut = -2000933L,
        OST_StairsNosingLines = -2000932L,
        OST_StairsCutMarksAboveCut = -2000931L,
        OST_StairsCutMarks = -2000930L,
        OST_ComponentRepeaterSlot = -2000928L,
        OST_ComponentRepeater = -2000927L,
        OST_DividedPath = -2000926L,
        OST_IOSRoomCalculationPoint = -2000925L,
        OST_PropertySet = -2000924L,
        OST_AppearanceAsset = -2000923L,
        OST_StairStringer2012_Deprecated = -2000922L,
        OST_StairsTrisers = -2000921L,
        OST_StairsLandings = -2000920L,
        OST_StairsRuns = -2000919L,
        OST_Stair2012_Deprecated = -2000918L,
        OST_RailingSystemTags = -2000917L,
        OST_RailingSystemTransition = -2000916L,
        OST_RailingSystemTermination = -2000915L,
        OST_RailingSystemRail = -2000914L,
        OST_RailingSystemTopRail = -2000913L,
        OST_RailingSystemHandRailBracket = -2000912L,
        OST_RailingSystemHandRail = -2000911L,
        OST_RailingSystemHardware = -2000910L,
        OST_RailingSystemPanel = -2000909L,
        OST_RailingSystemBaluster = -2000908L,
        OST_RailingSystemPost = -2000907L,
        OST_RailingSystemSegment = -2000906L,
        OST_RailingSystem = -2000905L,
        OST_AdaptivePoints_HiddenLines = -2000904L,
        OST_AdaptivePoints_Lines = -2000903L,
        OST_AdaptivePoints_Planes = -2000902L,
        OST_AdaptivePoints_Points = -2000901L,
        OST_AdaptivePoints = -2000900L,
        OST_CeilingOpening = -2000899L,
        OST_FloorOpening = -2000898L,
        OST_RoofOpening = -2000897L,
        OST_WallRefPlanes = -2000896L,
        OST_StructLocationLineControl = -2000880L,
        OST_PathOfTravelTags = -2000834L,
        OST_PathOfTravelLines = -2000833L,
        OST_DimLockControlLeader = -2000832L,
        OST_MEPSpaceSeparationLines = -2000831L,
        OST_AreaPolylines = -2000830L,
        OST_RoomPolylines = -2000829L,
        OST_InstanceDrivenLineStyle = -2000828L,
        OST_RemovedGridSeg = -2000827L,
        OST_IOSOpening = -2000810L,
        OST_IOSTilePatternGrid = -2000800L,
        OST_ControlLocal = -2000774L,
        OST_ControlAxisZ = -2000773L,
        OST_ControlAxisY = -2000772L,
        OST_ControlAxisX = -2000721L,
        OST_XRayConstrainedProfileEdge = -2000720L,
        OST_XRayImplicitPathCurve = -2000719L,
        OST_XRayPathPoint = -2000718L,
        OST_XRayPathCurve = -2000717L,
        OST_XRaySideEdge = -2000716L,
        OST_XRayProfileEdge = -2000715L,
        OST_ReferencePoints_HiddenLines = -2000714L,
        OST_ReferencePoints_Lines = -2000713L,
        OST_ReferencePoints_Planes = -2000712L,
        OST_ReferencePoints_Points = -2000711L,
        OST_ReferencePoints = -2000710L,
        OST_Materials = -2000700L,
        OST_CeilingsCutPattern = -2000617L,
        OST_CeilingsDefault = -2000616L,
        OST_CeilingsFinish2 = -2000615L,
        OST_CeilingsFinish1 = -2000614L,
        OST_CeilingsSubstrate = -2000613L,
        OST_CeilingsInsulation = -2000612L,
        OST_CeilingsStructure = -2000611L,
        OST_CeilingsMembrane = -2000610L,
        OST_FloorsInteriorEdges = -2000609L,
        OST_FloorsCutPattern = -2000608L,
        OST_HiddenFloorLines = -2000607L,
        OST_FloorsDefault = -2000606L,
        OST_FloorsFinish2 = -2000605L,
        OST_FloorsFinish1 = -2000604L,
        OST_FloorsSubstrate = -2000603L,
        OST_FloorsInsulation = -2000602L,
        OST_FloorsStructure = -2000601L,
        OST_FloorsMembrane = -2000600L,
        OST_RoofsInteriorEdges = -2000598L,
        OST_RoofsCutPattern = -2000597L,
        OST_RoofsDefault = -2000596L,
        OST_RoofsFinish2 = -2000595L,
        OST_RoofsFinish1 = -2000594L,
        OST_RoofsSubstrate = -2000593L,
        OST_RoofsInsulation = -2000592L,
        OST_RoofsStructure = -2000591L,
        OST_RoofsMembrane = -2000590L,
        OST_WallsCutPattern = -2000588L,
        OST_HiddenWallLines = -2000587L,
        OST_WallsDefault = -2000586L,
        OST_WallsFinish2 = -2000585L,
        OST_WallsFinish1 = -2000584L,
        OST_WallsSubstrate = -2000583L,
        OST_WallsInsulation = -2000582L,
        OST_WallsStructure = -2000581L,
        OST_WallsMembrane = -2000580L,
        OST_PreviewLegendComponents = -2000576L,
        OST_LegendComponents = -2000575L,
        OST_Schedules = -2000573L,
        OST_ScheduleGraphics = -2000570L,
        OST_RasterImages = -2000560L,
        OST_ColorFillSchema = -2000552L,
        OST_RoomColorFill = -2000551L,
        OST_ColorFillLegends = -2000550L,
        OST_AnnotationCropSpecial = -2000549L,
        OST_CropBoundarySpecial = -2000548L,
        OST_AnnotationCrop = -2000547L,
        OST_FloorsAnalyticalGeometry = -2000546L,
        OST_WallsAnalyticalGeometry = -2000545L,
        OST_CalloutLeaderLine = -2000544L,
        OST_CeilingsSurfacePattern = -2000543L,
        OST_RoofsSurfacePattern = -2000542L,
        OST_FloorsSurfacePattern = -2000541L,
        OST_WallsSurfacePattern = -2000540L,
        OST_CalloutBoundary = -2000539L,
        OST_CalloutHeads = -2000538L,
        OST_Callouts = -2000537L,
        OST_CropBoundary = -2000536L,
        OST_Elev = -2000535L,
        OST_AxisZ = -2000533L,
        OST_AxisY = -2000532L,
        OST_AxisX = -2000531L,
        OST_CLines = -2000530L,
        OST_Lights = -2000520L,
        OST_ViewportLabel = -2000515L,
        OST_Viewports = -2000510L,
        OST_Camera_Lines = -2000501L,
        OST_Cameras = -2000500L,
        OST_MEPSpaceTags = -2000485L,
        OST_RoomTags = -2000480L,
        OST_DoorTags = -2000460L,
        OST_WindowTags = -2000450L,
        OST_SectionHeadWideLines = -2000404L,
        OST_SectionHeadMediumLines = -2000403L,
        OST_SectionHeadThinLines = -2000401L,
        OST_SectionHeads = -2000400L,
        OST_ContourLabels = -2000350L,
        OST_CurtaSystemFaceManager = -2000341L,
        OST_CurtaSystem = -2000340L,
        OST_AreaReport_Arc_Minus = -2000328L,
        OST_AreaReport_Arc_Plus = -2000327L,
        OST_AreaReport_Boundary = -2000326L,
        OST_AreaReport_Triangle = -2000325L,
        OST_CurtainGridsCurtaSystem = -2000323L,
        OST_CurtainGridsSystem = -2000322L,
        OST_CurtainGridsWall = -2000321L,
        OST_CurtainGridsRoof = -2000320L,
        OST_HostFinHF = -2000315L,
        OST_HostFinWall = -2000314L,
        OST_HostFinCeiling = -2000313L,
        OST_HostFinRoof = -2000312L,
        OST_HostFinFloor = -2000311L,
        OST_HostFin = -2000310L,
        OST_AnalysisDisplayStyle = -2000304L,
        OST_AnalysisResults = -2000303L,
        OST_RenderRegions = -2000302L,
        OST_SectionBox = -2000301L,
        OST_TextNotes = -2000300L,
        OST_Divisions = -2000291L,
        OST_Catalogs = -2000290L,
        OST_DirectionEdgeLines = -2000289L,
        OST_CenterLines = -2000288L,
        OST_LinesBeyond = -2000287L,
        OST_HiddenLines = -2000286L,
        OST_DemolishedLines = -2000285L,
        OST_OverheadLines = -2000284L,
        OST_TitleBlockWideLines = -2000283L,
        OST_TitleBlockMediumLines = -2000282L,
        OST_TitleBlockThinLines = -2000281L,
        OST_TitleBlocks = -2000280L,
        OST_Views = -2000279L,
        OST_Viewers = -2000278L,
        OST_PartHiddenLines = -2000271L,
        OST_PartTags = -2000270L,
        OST_Parts = -2000269L,
        OST_AssemblyTags = -2000268L,
        OST_Assemblies = -2000267L,
        OST_RoofTags = -2000266L,
        OST_SpotSlopes = -2000265L,
        OST_SpotCoordinates = -2000264L,
        OST_SpotElevations = -2000263L,
        OST_Constraints = -2000262L,
        OST_WeakDims = -2000261L,
        OST_Dimensions = -2000260L,
        OST_Levels = -2000240L,
        OST_DisplacementPath = -2000223L,
        OST_DisplacementElements = -2000222L,
        OST_GridChains = -2000221L,
        OST_Grids = -2000220L,
        OST_BrokenSectionLine = -2000202L,
        OST_SectionLine = -2000201L,
        OST_Sections = -2000200L,
        OST_ReferenceViewer = -2000198L,
        OST_ReferenceViewerSymbol = -2000197L,
        OST_ImportObjectStyles = -2000196L,
        OST_ModelText = -2000195L,
        OST_MaskingRegion = -2000194L,
        OST_Matchline = -2000193L,
        OST_FaceSplitter = -2000192L,
        OST_PlanRegion = -2000191L,
        OST_FilledRegion = -2000190L,
        OST_MassingProjectionOutlines = -2000187L,
        OST_MassingCutOutlines = -2000186L,
        OST_Massing = -2000185L,
        OST_Reveals = -2000182L,
        OST_Cornices = -2000181L,
        OST_Ramps = -2000180L,
        OST_RailingBalusterRailCut = -2000177L,
        OST_RailingBalusterRail = -2000176L,
        OST_Railings = -2000175L,
        OST_CurtainGrids = -2000173L,
        OST_CurtainWallMullionsCut = -2000172L,
        OST_CurtainWallMullions = -2000171L,
        OST_CurtainWallPanels = -2000170L,
        OST_AreaReference = -2000169L,
        OST_AreaInteriorFill = -2000168L,
        OST_RoomReference = -2000167L,
        OST_RoomInteriorFill = -2000166L,
        OST_AreaColorFill = -2000165L,
        OST_AreaReferenceVisibility = -2000164L,
        OST_AreaInteriorFillVisibility = -2000163L,
        OST_RoomReferenceVisibility = -2000162L,
        OST_RoomInteriorFillVisibility = -2000161L,
        OST_Rooms = -2000160L,
        OST_GenericModel = -2000151L,
        OST_GenericAnnotation = -2000150L,
        OST_Fixtures = -2000140L,
        OST_StairsRailingTags = -2000133L,
        OST_StairsRailingAboveCut = -2000132L,
        OST_StairsDownArrows = -2000131L,
        OST_StairsUpArrows = -2000130L,
        OST_StairsDownText = -2000129L,
        OST_StairsRailingRail = -2000128L,
        OST_StairsRailingBaluster = -2000127L,
        OST_StairsRailing = -2000126L,
        OST_StairsUpText = -2000125L,
        OST_StairsSupportsAboveCut = -2000124L,
        OST_StairsStringerCarriage = -2000123L,
        OST_StairsAboveCut_ToBeDeprecated = -2000122L,
        OST_StairsIncomplete_Deprecated = -2000121L,
        OST_Stairs = -2000120L,
        OST_IOSNavWheelPivotBall = -2000117L,
        OST_IOSRoomComputationHeight = -2000116L,
        OST_IOSRoomUpperLowerLines = -2000115L,
        OST_IOSDragBoxInverted = -2000114L,
        OST_IOSDragBox = -2000113L,
        OST_Phases = -2000112L,
        OST_IOS_GeoSite = -2000111L,
        OST_IOS_GeoLocations = -2000110L,
        OST_IOSFabricReinSpanSymbolCtrl = -2000109L,
        OST_GuideGrid = -2000107L,
        OST_EPS_Future = -2000106L,
        OST_EPS_Temporary = -2000105L,
        OST_EPS_New = -2000104L,
        OST_EPS_Demolished = -2000103L,
        OST_EPS_Existing = -2000102L,
        OST_IOSMeasureLineScreenSize = -2000101L,
        OST_Columns = -2000100L,
        OST_IOSRebarSystemSpanSymbolCtrl = -2000099L,
        OST_IOSRoomTagToRoomLines = -2000098L,
        OST_IOSAttachedDetailGroups = -2000097L,
        OST_IOSDetailGroups = -2000096L,
        OST_IOSModelGroups = -2000095L,
        OST_IOSSuspendedSketch = -2000094L,
        OST_IOSWallCoreBoundary = -2000093L,
        OST_IOSMeasureLine = -2000092L,
        OST_IOSArrays = -2000091L,
        OST_Curtain_Systems = -2000090L,
        OST_IOSBBoxScreenSize = -2000089L,
        OST_IOSSlabShapeEditorPointInterior = -2000088L,
        OST_IOSSlabShapeEditorPointBoundary = -2000087L,
        OST_IOSSlabShapeEditorBoundary = -2000086L,
        OST_IOSSlabShapeEditorAutoCrease = -2000085L,
        OST_IOSSlabShapeEditorExplitCrease = -2000084L,
        OST_ReferenceLines = -2000083L,
        OST_IOSNotSilhouette = -2000082L,
        OST_FillPatterns = -2000081L,
        OST_Furniture = -2000080L,
        OST_AreaSchemeLines = -2000079L,
        OST_GenericLines = -2000078L,
        OST_InsulationLines = -2000077L,
        OST_CloudLines = -2000076L,
        OST_IOSRoomPerimeterLines = -2000075L,
        OST_IOSCuttingGeometry = -2000074L,
        OST_IOSCrashGraphics = -2000073L,
        OST_IOSGroups = -2000072L,
        OST_IOSGhost = -2000071L,
        OST_StairsSketchLandingCenterLines = -2000070L,
        OST_StairsSketchRunLines = -2000069L,
        OST_StairsSketchRiserLines = -2000068L,
        OST_StairsSketchBoundaryLines = -2000067L,
        OST_RoomSeparationLines = -2000066L,
        OST_AxisOfRotation = -2000065L,
        OST_InvisibleLines = -2000064L,
        OST_IOSThinPixel_DashDot = -2000063L,
        OST_IOSThinPixel_Dash = -2000062L,
        OST_IOSThinPixel_Dot = -2000061L,
        OST_Extrusions = -2000060L,
        OST_IOS = -2000059L,
        OST_CutOutlines = -2000058L,
        OST_IOSThinPixel = -2000057L,
        OST_IOSFlipControl = -2000056L,
        OST_IOSSketchGrid = -2000055L,
        OST_IOSSuspendedSketch_obsolete = -2000054L,
        OST_IOSFreeSnapLine = -2000053L,
        OST_IOSDatumPlane = -2000052L,
        OST_Lines = -2000051L,
        OST_IOSConstructionLine = -2000050L,
        OST_IOSAlignmentGraphics = -2000049L,
        OST_IOSAligningLine = -2000048L,
        OST_IOSBackedUpElements = -2000047L,
        OST_IOSRegeneratedElements = -2000046L,
        OST_SketchLines = -2000045L,
        OST_CurvesWideLines = -2000044L,
        OST_CurvesMediumLines = -2000043L,
        OST_CurvesThinLines = -2000042L,
        OST_Curves = -2000041L,
        OST_CeilingsProjection = -2000040L,
        OST_CeilingsCut = -2000039L,
        OST_Ceilings = -2000038L,
        OST_RoofsProjection = -2000037L,
        OST_RoofsCut = -2000036L,
        OST_Roofs = -2000035L,
        OST_FloorsProjection = -2000034L,
        OST_FloorsCut = -2000033L,
        OST_Floors = -2000032L,
        OST_DoorsGlassProjection = -2000031L,
        OST_DoorsGlassCut = -2000030L,
        OST_DoorsFrameMullionProjection = -2000029L,
        OST_DoorsFrameMullionCut = -2000028L,
        OST_DoorsOpeningProjection = -2000027L,
        OST_DoorsOpeningCut = -2000026L,
        OST_DoorsPanelProjection = -2000025L,
        OST_DoorsPanelCut = -2000024L,
        OST_Doors = -2000023L,
        OST_WindowsOpeningProjection = -2000022L,
        OST_WindowsOpeningCut = -2000021L,
        OST_WindowsSillHeadProjection = -2000020L,
        OST_WindowsSillHeadCut = -2000019L,
        OST_WindowsFrameMullionProjection = -2000018L,
        OST_WindowsFrameMullionCut = -2000017L,
        OST_WindowsGlassProjection = -2000016L,
        OST_WindowsGlassCut = -2000015L,
        OST_Windows = -2000014L,
        OST_WallsProjectionOutlines = -2000013L,
        OST_WallsCutOutlines = -2000012L,
        OST_Walls = -2000011L,
        OST_IOSRegenerationFailure = -2000010L,
        OST_ScheduleViewParamGroup = -2000008L,
        OST_MatchSiteComponent = -2000007L,
        OST_MatchProfile = -2000006L,
        OST_MatchDetail = -2000005L,
        OST_MatchAnnotation = -2000004L,
        OST_MatchModel = -2000003L,
        OST_MatchAll = -2000002L,
        INVALID = -1L,
    }
}