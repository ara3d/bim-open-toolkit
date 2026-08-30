using System.Collections.Generic;
using System.Reflection;

namespace Ara3D.BimOpenSchema;

public record RevitParameterDesc(string Name, ParameterType Type)
{
    public static implicit operator string(RevitParameterDesc p) => p.Name;
}

public static class CommonRevitParameters
{
    public const string DocumentEntityName = "__DOCUMENT__";
    public const string BoundaryEntityName = "__BOUNDARY__";
    public const string ConnectorEntityName = "__CONNECTOR__";
    public const string CategoryEntityName = "__CATEGORY__";

    // =========================
    // Object
    // =========================

    public static RevitParameterDesc ObjectTypeName = new("Bos:Object:TypeName", ParameterType.String);
    
    // =========================
    // Element
    // =========================

    public static RevitParameterDesc ElementLevel = new("Rvt:Element:Level", ParameterType.Entity);
    public static RevitParameterDesc ElementLocationPoint = new("Rvt:Element:Location.Point", ParameterType.Point);
    public static RevitParameterDesc ElementLocationStartPoint = new("Rvt:Element:Location.StartPoint", ParameterType.Point);
    public static RevitParameterDesc ElementLocationEndPoint = new("Rvt:Element:Location.EndPoint", ParameterType.Point);
    public static RevitParameterDesc ElementBoundsMin = new("Rvt:Element:Bounds.Min", ParameterType.Point);
    public static RevitParameterDesc ElementBoundsMax = new("Rvt:Element:Bounds.Max", ParameterType.Point);
    public static RevitParameterDesc ElementAssemblyInstance = new("Rvt:Element:AssemblyInstance", ParameterType.Entity);
    public static RevitParameterDesc ElementDesignOption = new("Rvt:Element:DesignOption", ParameterType.Entity);
    public static RevitParameterDesc ElementGroup = new("Rvt:Element:Group", ParameterType.Entity);
    public static RevitParameterDesc ElementWorksetId = new("Rvt:Element:WorksetId", ParameterType.Int);
    public static RevitParameterDesc ElementCreatedPhase = new("Rvt:Element:CreatedPhase", ParameterType.Entity);
    public static RevitParameterDesc ElementDemolishedPhase = new("Rvt:Element:DemolishedPhase", ParameterType.Entity);
    public static RevitParameterDesc ElementIsViewSpecific = new("Rvt:Element:IsViewSpecific", ParameterType.Int);
    public static RevitParameterDesc ElementOwnerView = new("Rvt:Element:OwnerView", ParameterType.Entity);

    // =========================
    // FamilyInstance
    // =========================

    public static RevitParameterDesc FIToRoom = new("Rvt:FamilyInstance:ToRoom", ParameterType.Entity);
    public static RevitParameterDesc FIFromRoom = new("Rvt:FamilyInstance:FromRoom", ParameterType.Entity);
    public static RevitParameterDesc FIHost = new("Rvt:FamilyInstance:Host", ParameterType.Entity);
    public static RevitParameterDesc FISpace = new("Rvt:FamilyInstance:Space", ParameterType.Entity);
    public static RevitParameterDesc FIRoom = new("Rvt:FamilyInstance:Room", ParameterType.Entity);
    public static RevitParameterDesc FIStructuralUsage = new("Rvt:FamilyInstance:StructuralUsage", ParameterType.String);
    public static RevitParameterDesc FIStructuralMaterialType = new("Rvt:FamilyInstance:StructuralMaterialType", ParameterType.String);
    public static RevitParameterDesc FIStructuralMaterial = new("Rvt:FamilyInstance:StructuralMaterial", ParameterType.Entity);
    public static RevitParameterDesc FIStructuralType = new("Rvt:FamilyInstance:StructuralType", ParameterType.String);

    // =========================
    // Family
    // =========================

    public static RevitParameterDesc FamilyStructuralCodeName = new("Rvt:Family:StructuralCodeName", ParameterType.String);
    public static RevitParameterDesc FamilyStructuralMaterialType = new("Rvt:Family:StructuralMaterialType", ParameterType.String);

    // =========================
    // Area
    // =========================

    public static RevitParameterDesc AreaSchemeRevitParameterDesc = new("Rvt:Area:Scheme", ParameterType.Entity);
    public static RevitParameterDesc AreaIsGrossInterior = new("Rvt:Area:IsGrossInterior", ParameterType.Bool);

    // =========================
    // Room
    // =========================

    public static RevitParameterDesc RoomNumber = new("Rvt:Room:Number", ParameterType.String);
    public static RevitParameterDesc RoomBaseOffset = new("Rvt:Room:BaseOffset", ParameterType.Number);
    public static RevitParameterDesc RoomLimitOffset = new("Rvt:Room:LimitOffset", ParameterType.Number);
    public static RevitParameterDesc RoomUnboundedHeight = new("Rvt:Room:UnboundedHeight", ParameterType.Number);
    public static RevitParameterDesc RoomVolume = new("Rvt:Room:Volume", ParameterType.Number);
    public static RevitParameterDesc RoomUpperLimit = new("Rvt:Room:UpperLimit", ParameterType.Entity);

    // =========================
    // Space
    // =========================

    public static RevitParameterDesc SpaceActualExhaustAirflow = new("Rvt:Space:ActualExhaustAirflow", ParameterType.Number);
    public static RevitParameterDesc SpaceActualHVACLoad = new("Rvt:Space:ActualHVACLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceActualLightingLoad = new("Rvt:Space:ActualLightingLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceActualOtherLoad = new("Rvt:Space:ActualOtherLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceActualPowerLoad = new("Rvt:Space:ActualPowerLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceActualReturnAirflow = new("Rvt:Space:ActualReturnAirflow", ParameterType.Number);
    public static RevitParameterDesc SpaceActualSupplyAirflow = new("Rvt:Space:ActualSupplyAirflow", ParameterType.Number);
    public static RevitParameterDesc SpaceAirChangesPerHour = new("Rvt:Space:AirChangesPerHour", ParameterType.Number);
    public static RevitParameterDesc SpaceAreaPerPerson = new("Rvt:Space:AreaPerPerson", ParameterType.Number);
    public static RevitParameterDesc SpaceAverageEstimatedIllumination = new("Rvt:Space:AverageEstimatedIllumination", ParameterType.Number);
    public static RevitParameterDesc SpaceBaseHeatLoadOn = new("Rvt:Space:BaseHeatLoadOn", ParameterType.String);
    public static RevitParameterDesc SpaceBaseOffset = new("Rvt:Space:BaseOffset", ParameterType.Number);
    public static RevitParameterDesc SpaceLimitOffset = new("Rvt:Space:LimitOffset", ParameterType.Number);
    public static RevitParameterDesc SpaceUnboundedHeight = new("Rvt:Space:UnboundedHeight", ParameterType.Number);
    public static RevitParameterDesc SpaceCalculatedCoolingLoad = new("Rvt:Space:CalculatedCoolingLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceCalculatedHeatingLoad = new("Rvt:Space:CalculatedHeatingLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceCalculatedSupplyAirflow = new("Rvt:Space:CalculatedSupplyAirflow", ParameterType.Number);
    public static RevitParameterDesc SpaceCeilingReflectance = new("Rvt:Space:CeilingReflectance", ParameterType.Number);
    public static RevitParameterDesc SpaceFloorReflectance = new("Rvt:Space:FloorReflectance", ParameterType.Number);
    public static RevitParameterDesc SpaceWallReflectance = new("Rvt:Space:WallReflectance", ParameterType.Number);
    public static RevitParameterDesc SpaceConditionType = new("Rvt:Space:ConditionType", ParameterType.String);
    public static RevitParameterDesc SpaceLightingLoadUnit = new("Rvt:Space:LightingLoadUnit", ParameterType.String);
    public static RevitParameterDesc SpacePowerLoadUnit = new("Rvt:Space:PowerLoadUnit", ParameterType.String);
    public static RevitParameterDesc SpaceOccupancyUnit = new("Rvt:Space:OccupancyUnit", ParameterType.String);
    public static RevitParameterDesc SpaceOutdoorAirFlowStandard = new("Rvt:Space:OutdoorAirFlowStandard", ParameterType.String);
    public static RevitParameterDesc SpaceSpaceType = new("Rvt:Space:SpaceType", ParameterType.String);
    public static RevitParameterDesc SpaceDesignCoolingLoad = new("Rvt:Space:DesignCoolingLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceDesignExhaustAirflow = new("Rvt:Space:DesignExhaustAirflow", ParameterType.Number);
    public static RevitParameterDesc SpaceDesignHeatingLoad = new("Rvt:Space:DesignHeatingLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceDesignHVACLoadPerArea = new("Rvt:Space:DesignHVACLoadPerArea", ParameterType.Number);
    public static RevitParameterDesc SpaceDesignLightingLoad = new("Rvt:Space:DesignLightingLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceDesignOtherLoadPerArea = new("Rvt:Space:DesignOtherLoadPerArea", ParameterType.Number);
    public static RevitParameterDesc SpaceDesignPowerLoad = new("Rvt:Space:DesignPowerLoad", ParameterType.Number);
    public static RevitParameterDesc SpaceDesignReturnAirflow = new("Rvt:Space:DesignReturnAirflow", ParameterType.Number);
    public static RevitParameterDesc SpaceDesignSupplyAirflow = new("Rvt:Space:DesignSupplyAirflow", ParameterType.Number);
    public static RevitParameterDesc SpaceNumberOfPeople = new("Rvt:Space:NumberOfPeople", ParameterType.Number);
    public static RevitParameterDesc SpaceLatentHeatGainPerPerson = new("Rvt:Space:LatentHeatGainPerPerson", ParameterType.Number);
    public static RevitParameterDesc SpaceSensibleHeatGainPerPerson = new("Rvt:Space:SensibleHeatGainPerPerson", ParameterType.Number);
    public static RevitParameterDesc SpaceOutdoorAirflow = new("Rvt:Space:OutdoorAirflow", ParameterType.Number);
    public static RevitParameterDesc SpaceOutdoorAirPerArea = new("Rvt:Space:OutdoorAirPerArea", ParameterType.Number);
    public static RevitParameterDesc SpaceOutdoorAirPerPerson = new("Rvt:Space:OutdoorAirPerPerson", ParameterType.Number);
    public static RevitParameterDesc SpaceLightingCalculationWorkplane = new("Rvt:Space:LightingCalculationWorkplane", ParameterType.Number);
    public static RevitParameterDesc SpaceReturnAirflow = new("Rvt:Space:ReturnAirflow", ParameterType.String);
    public static RevitParameterDesc SpaceSpaceCavityRatio = new("Rvt:Space:SpaceCavityRatio", ParameterType.Number);
    public static RevitParameterDesc SpaceVolume = new("Rvt:Space:Volume", ParameterType.Number);
    public static RevitParameterDesc SpaceOccupiable = new("Rvt:Space:Occupiable", ParameterType.Bool);
    public static RevitParameterDesc SpacePlenum = new("Rvt:Space:Plenum", ParameterType.Bool);
    public static RevitParameterDesc SpaceUpperLimit = new("Rvt:Space:UpperLimit", ParameterType.Entity);      // Level
    public static RevitParameterDesc SpaceRoom = new("Rvt:Space:Room", ParameterType.Entity);            // Related Room
    public static RevitParameterDesc SpaceSpaceTypeElement = new("Rvt:Space:SpaceTypeElement", ParameterType.Entity);  // SpaceTypeId
    public static RevitParameterDesc SpaceZone = new("Rvt:Space:Zone", ParameterType.Entity);            // Zone this space belongs to

    // =========================
    // Level
    // =========================

    public static RevitParameterDesc LevelProjectElevation = new("Rvt:Level:ProjectElevation", ParameterType.Number);
    public static RevitParameterDesc LevelElevation = new("Rvt:Level:Elevation", ParameterType.Number);

    // =========================
    // Material
    // =========================

    public static RevitParameterDesc MaterialColorRed = new("Rvt:Material:Color.Red", ParameterType.Number);
    public static RevitParameterDesc MaterialColorGreen = new("Rvt:Material:Color.Green", ParameterType.Number);
    public static RevitParameterDesc MaterialColorBlue = new("Rvt:Material:Color.Blue", ParameterType.Number);
    public static RevitParameterDesc MaterialShininess = new("Rvt:Material:Shininess", ParameterType.Number);
    public static RevitParameterDesc MaterialSmoothness = new("Rvt:Material:Smoothness", ParameterType.Number);
    public static RevitParameterDesc MaterialCategory = new("Rvt:Material:Category", ParameterType.String);
    public static RevitParameterDesc MaterialClass = new("Rvt:Material:Class", ParameterType.String);
    public static RevitParameterDesc MaterialTransparency = new("Rvt:Material:Transparency", ParameterType.Number);

    // =========================
    // TextNote
    // =========================

    public static RevitParameterDesc TextNoteCoord = new("Rvt:TextNote:Coord", ParameterType.Point);
    public static RevitParameterDesc TextNoteDir = new("Rvt:TextNote:Dir", ParameterType.Point);
    public static RevitParameterDesc TextNoteText = new("Rvt:TextNote:Text", ParameterType.String);
    public static RevitParameterDesc TextNoteWidth = new("Rvt:TextNote:Width", ParameterType.Number);
    public static RevitParameterDesc TextNoteHeight = new("Rvt:TextNote:Height", ParameterType.Number);

    // =========================
    // Layer
    // =========================

    public static RevitParameterDesc LayerIndex = new("Rvt:Layer:Index", ParameterType.Int);
    public static RevitParameterDesc LayerFunction = new("Rvt:Layer:Function", ParameterType.String);
    public static RevitParameterDesc LayerWidth = new("Rvt:Layer:Width", ParameterType.Number);
    public static RevitParameterDesc LayerMaterialId = new("Rvt:Layer:MaterialId", ParameterType.Entity);
    public static RevitParameterDesc LayerIsCore = new("Rvt:Layer:IsCore", ParameterType.Int);

    // =========================
    // Document
    // =========================

    public static RevitParameterDesc DocumentCreationGuid = new("Rvt:Document:CreationGuid", ParameterType.String);
    public static RevitParameterDesc DocumentWorksharingGuid = new("Rvt:Document:WorksharingGuid", ParameterType.String);
    public static RevitParameterDesc DocumentTitle = new("Rvt:Document:Title", ParameterType.String);
    public static RevitParameterDesc DocumentPath = new("Rvt:Document:Path", ParameterType.String);
    public static RevitParameterDesc DocumentElevation = new("Rvt:Document:Elevation", ParameterType.Number);
    public static RevitParameterDesc DocumentLatitude = new("Rvt:Document:Latitude", ParameterType.Number);
    public static RevitParameterDesc DocumentLongitude = new("Rvt:Document:Longitude", ParameterType.Number);
    public static RevitParameterDesc DocumentPlaceName = new("Rvt:Document:PlaceName", ParameterType.String);
    public static RevitParameterDesc DocumentWeatherStationName = new("Rvt:Document:WeatherStationName", ParameterType.String);
    public static RevitParameterDesc DocumentTimeZone = new("Rvt:Document:TimeZone", ParameterType.Number);
    public static RevitParameterDesc DocumentLastSaveTime = new("Rvt:Document:LastSaveTime", ParameterType.String);
    public static RevitParameterDesc DocumentSaveCount = new("Rvt:Document:SaveCount", ParameterType.Int);
    public static RevitParameterDesc DocumentIsDetached = new("Rvt:Document:IsDetached", ParameterType.Int);
    public static RevitParameterDesc DocumentIsLinked = new("Rvt:Document:IsLinked", ParameterType.Int);
    public static RevitParameterDesc DocumentLinkName = new("Rvt:Document:LinkName", ParameterType.String);
    public static RevitParameterDesc DocumentExternalPath = new("Rvt:Document:ExternalPath", ParameterType.String);

    // =========================
    // Project
    // =========================

    public static RevitParameterDesc ProjectName = new("Rvt:Document:Project:Name", ParameterType.String);
    public static RevitParameterDesc ProjectNumber = new("Rvt:Document:Project:Number", ParameterType.String);
    public static RevitParameterDesc ProjectStatus = new("Rvt:Document:Project:Status", ParameterType.String);
    public static RevitParameterDesc ProjectAddress = new("Rvt:Document:Project:Address", ParameterType.String);
    public static RevitParameterDesc ProjectClientName = new("Rvt:Document:Project:Client", ParameterType.String);
    public static RevitParameterDesc ProjectIssueDate = new("Rvt:Document:Project:IssueDate", ParameterType.String);
    public static RevitParameterDesc ProjectAuthor = new("Rvt:Document:Project:Author", ParameterType.String);
    public static RevitParameterDesc ProjectBuildingName = new("Rvt:Document:Project:BuildingName", ParameterType.String);
    public static RevitParameterDesc ProjectOrgDescription = new("Rvt:Document:Project:OrganizationDescription", ParameterType.String);
    public static RevitParameterDesc ProjectOrgName = new("Rvt:Document:Project:OrganizationName", ParameterType.String);

    // =========================
    // Boundary 
    // =========================
    
    public static RevitParameterDesc BoundaryOuter = new("Rvt:Boundary:Outer", ParameterType.Int);
    public static RevitParameterDesc BoundaryElement = new("Rvt:Boundary:Element", ParameterType.Entity);

    // =========================
    // Category
    // =========================
    
    public static RevitParameterDesc CategoryCategoryType = new("Rvt:Category:CategoryType", ParameterType.String);
    public static RevitParameterDesc CategoryBuiltInType = new("Rvt:Category:BuiltInType", ParameterType.String);

    // =========================
    // Zone
    // =========================

    // NOTE: we do not include Calculated properties
    public static RevitParameterDesc ZoneArea = new("Rvt:Zone:Area", ParameterType.Number);
    public static RevitParameterDesc ZoneCoolingAirTemperature = new("Rvt:Zone:CoolingAirTemperature", ParameterType.Number);
    public static RevitParameterDesc ZoneCoolingSetPoint = new("Rvt:Zone:CoolingSetPoint", ParameterType.Number);
    public static RevitParameterDesc ZoneDehumidificationSetPoint = new("Rvt:Zone:DehumidificationSetPoint", ParameterType.Number);
    public static RevitParameterDesc ZoneGrossArea = new("Rvt:Zone:GrossArea", ParameterType.Number);
    public static RevitParameterDesc ZoneGrossVolume = new("Rvt:Zone:GrossVolume", ParameterType.Number);
    public static RevitParameterDesc ZoneHeatingAirTemperature = new("Rvt:Zone:HeatingAirTemperature", ParameterType.Number);
    public static RevitParameterDesc ZoneHeatingSetPoint = new("Rvt:Zone:HeatingSetPoint", ParameterType.Number);
    public static RevitParameterDesc ZonePerimeter = new("Rvt:Zone:Perimeter", ParameterType.Number);
    public static RevitParameterDesc ZoneServiceType = new("Rvt:Zone:ServiceType", ParameterType.String);

    // =========================
    // MEP System (base)
    // =========================

    public static RevitParameterDesc MepSystemHasDesignParts = new("Rvt:MepSystem:HasDesignParts", ParameterType.Int);
    public static RevitParameterDesc MepSystemHasFabricationParts = new("Rvt:MepSystem:HasFabricationParts", ParameterType.Int);
    public static RevitParameterDesc MepSystemHasPlaceholders = new("Rvt:MepSystem:HasPlaceholders", ParameterType.Int);
    public static RevitParameterDesc MepSystemIsEmpty = new("Rvt:MepSystem:IsEmpty", ParameterType.Int);
    public static RevitParameterDesc MepSystemIsMultipleNetwork = new("Rvt:MepSystem:IsMultipleNetwork", ParameterType.Int);
    public static RevitParameterDesc MepSystemIsValid = new("Rvt:MepSystem:IsValid", ParameterType.Int);
    public static RevitParameterDesc MepSystemSectionsCount = new("Rvt:MepSystem:SectionsCount", ParameterType.Int);
    public static RevitParameterDesc MepSystemBaseEquipment = new("Rvt:MepSystem:BaseEquipment", ParameterType.Entity);
    public static RevitParameterDesc MepSystemBaseEquipmentConnector = new("Rvt:MepSystem:BaseEquipmentConnector", ParameterType.Entity);

    // =========================
    // Mechanical System
    // =========================

    public static RevitParameterDesc MechSystemType = new("Rvt:MechanicalSystem:SystemType", ParameterType.String);
    public static RevitParameterDesc MechSystemIsWellConnected = new("Rvt:MechanicalSystem:IsWellConnected", ParameterType.Int);

    // =========================
    // Electrical System
    // =========================

    public static RevitParameterDesc ElecSystemType = new("Rvt:ElectricalSystem:SystemType", ParameterType.String);
    public static RevitParameterDesc ElecSystemApparentCurrent = new("Rvt:ElectricalSystem:ApparentCurrent", ParameterType.Number);
    public static RevitParameterDesc ElecSystemApparentLoad = new("Rvt:ElectricalSystem:ApparentLoad", ParameterType.Number);
    public static RevitParameterDesc ElecSystemBalancedLoad = new("Rvt:ElectricalSystem:BalancedLoad", ParameterType.Int);
    public static RevitParameterDesc ElecSystemCircuitConnectionType = new("Rvt:ElectricalSystem:CircuitConnectionType", ParameterType.String);
    public static RevitParameterDesc ElecSystemCircuitType = new("Rvt:ElectricalSystem:CircuitType", ParameterType.String);
    public static RevitParameterDesc ElecSystemCircuitNumber = new("Rvt:ElectricalSystem:CircuitNumber", ParameterType.String);
    public static RevitParameterDesc ElecSystemFrame = new("Rvt:ElectricalSystem:Frame", ParameterType.Number);
    public static RevitParameterDesc ElecSystemHasCustomCircuitPath = new("Rvt:ElectricalSystem:HasCustomCircuitPath", ParameterType.Int);
    public static RevitParameterDesc ElecSystemHotConductorsNumber = new("Rvt:ElectricalSystem:HotConductorsNumber", ParameterType.Int);
    public static RevitParameterDesc ElecSystemIsBasePanelFeedThroughLugsOccupied = new("Rvt:ElectricalSystem:IsBasePanelFeedThroughLugsOccupied", ParameterType.Int);
    public static RevitParameterDesc ElecSystemLength = new("Rvt:ElectricalSystem:Length", ParameterType.Number);
    public static RevitParameterDesc ElecSystemLoadClassificationAbbreviations = new("Rvt:ElectricalSystem:LoadClassificationAbbreviations", ParameterType.String);
    public static RevitParameterDesc ElecSystemLoadClassifications = new("Rvt:ElectricalSystem:LoadClassifications", ParameterType.String);
    public static RevitParameterDesc ElecSystemLoadName = new("Rvt:ElectricalSystem:LoadName", ParameterType.String);
    public static RevitParameterDesc ElecSystemNeutralConductorsNumber = new("Rvt:ElectricalSystem:NeutralConductorsNumber", ParameterType.Int);
    public static RevitParameterDesc ElecSystemPanelName = new("Rvt:ElectricalSystem:PanelName", ParameterType.String);
    public static RevitParameterDesc ElecSystemPhaseLabel = new("Rvt:ElectricalSystem:PhaseLabel", ParameterType.String);
    public static RevitParameterDesc ElecSystemPolesNumber = new("Rvt:ElectricalSystem:PolesNumber", ParameterType.Int);
    public static RevitParameterDesc ElecSystemPowerFactor = new("Rvt:ElectricalSystem:PowerFactor", ParameterType.Number);
    public static RevitParameterDesc ElecSystemPowerFactorState = new("Rvt:ElectricalSystem:PowerFactorState", ParameterType.String);
    public static RevitParameterDesc ElecSystemRating = new("Rvt:ElectricalSystem:Rating", ParameterType.Number);
    public static RevitParameterDesc ElecSystemRunsNumber = new("Rvt:ElectricalSystem:RunsNumber", ParameterType.Int);
    public static RevitParameterDesc ElecSystemSlotIndex = new("Rvt:ElectricalSystem:SlotIndex", ParameterType.String);
    public static RevitParameterDesc ElecSystemStartSlot = new("Rvt:ElectricalSystem:StartSlot", ParameterType.Int);
    public static RevitParameterDesc ElecSystemTrueCurrent = new("Rvt:ElectricalSystem:TrueCurrent", ParameterType.Number);
    public static RevitParameterDesc ElecSystemTrueLoad = new("Rvt:ElectricalSystem:TrueLoad", ParameterType.Number);
    public static RevitParameterDesc ElecSystemVoltage = new("Rvt:ElectricalSystem:Voltage", ParameterType.Number);
    public static RevitParameterDesc ElecSystemWays = new("Rvt:ElectricalSystem:Ways", ParameterType.Int);
    public static RevitParameterDesc ElecSystemWireType = new("Rvt:ElectricalSystem:WireType", ParameterType.String);

    // =========================
    // Connector
    // =========================

    public static RevitParameterDesc ConnectorAllowsSlopeAdjustments = new("Rvt:Connector:AllowsSlopeAdjustments", ParameterType.Int);
    public static RevitParameterDesc ConnectorAngle = new("Rvt:Connector:Angle", ParameterType.Number);
    public static RevitParameterDesc ConnectorAssignedDuctFlowConfiguration = new("Rvt:Connector:AssignedDuctFlowConfiguration", ParameterType.String);
    public static RevitParameterDesc ConnectorAssignedDuctLossMethod = new("Rvt:Connector:AssignedDuctLossMethod", ParameterType.String);
    public static RevitParameterDesc ConnectorAssignedFixtureUnits = new("Rvt:Connector:AssignedFixtureUnits", ParameterType.Number);
    public static RevitParameterDesc ConnectorAssignedFlow = new("Rvt:Connector:AssignedFlow", ParameterType.Number);
    public static RevitParameterDesc ConnectorAssignedFlowDirection = new("Rvt:Connector:AssignedFlowDirection", ParameterType.String);
    public static RevitParameterDesc ConnectorAssignedFlowFactor = new("Rvt:Connector:AssignedFlowFactor", ParameterType.Number);
    public static RevitParameterDesc ConnectorAssignedKCoefficient = new("Rvt:Connector:AssignedKCoefficient", ParameterType.Number);
    public static RevitParameterDesc ConnectorAssignedLossCoefficient = new("Rvt:Connector:AssignedLossCoefficient", ParameterType.Number);
    public static RevitParameterDesc ConnectorAssignedPipeFlowConfiguration = new("Rvt:Connector:AssignedPipeFlowConfiguration", ParameterType.String);
    public static RevitParameterDesc ConnectorAssignedPipeLossMethod = new("Rvt:Connector:AssignedPipeLossMethod", ParameterType.String);
    public static RevitParameterDesc ConnectorAssignedPressureDrop = new("Rvt:Connector:AssignedPressureDrop", ParameterType.Number);
    public static RevitParameterDesc ConnectorCoefficient = new("Rvt:Connector:Coefficient", ParameterType.Number);
    public static RevitParameterDesc ConnectorDemand = new("Rvt:Connector:Demand", ParameterType.Number);
    public static RevitParameterDesc ConnectorFlow = new("Rvt:Connector:Flow", ParameterType.Number);
    public static RevitParameterDesc ConnectorPressureDrop = new("Rvt:Connector:PressureDrop", ParameterType.Number);
    public static RevitParameterDesc ConnectorVelocityPressure = new("Rvt:Connector:VelocityPressure", ParameterType.Number);
    public static RevitParameterDesc ConnectorHeight = new("Rvt:Connector:Height", ParameterType.Number);
    public static RevitParameterDesc ConnectorWidth = new("Rvt:Connector:Width", ParameterType.Number);
    public static RevitParameterDesc ConnectorRadius = new("Rvt:Connector:Radius", ParameterType.Number);
    public static RevitParameterDesc ConnectorEngagementLength = new("Rvt:Connector:EngagementLength", ParameterType.Number);
    public static RevitParameterDesc ConnectorId = new("Rvt:Connector:Id", ParameterType.String); // int, but safest as string
    public static RevitParameterDesc ConnectorTypeStr = new("Rvt:Connector:Type", ParameterType.String);
    public static RevitParameterDesc ConnectorShape = new("Rvt:Connector:Shape", ParameterType.String);
    public static RevitParameterDesc ConnectorDomain = new("Rvt:Connector:Domain", ParameterType.String);
    public static RevitParameterDesc ConnectorDuctSystemType = new("Rvt:Connector:DuctSystemType", ParameterType.String);
    public static RevitParameterDesc ConnectorElectricalSystemType = new("Rvt:Connector:ElectricalSystemType", ParameterType.String);
    public static RevitParameterDesc ConnectorPipeSystemType = new("Rvt:Connector:PipeSystemType", ParameterType.String);
    public static RevitParameterDesc ConnectorUtility = new("Rvt:Connector:Utility", ParameterType.Int);
    public static RevitParameterDesc ConnectorDescription = new("Rvt:Connector:Description", ParameterType.String);
    public static RevitParameterDesc ConnectorOrigin = new("Rvt:Connector:Origin", ParameterType.Point);
    public static RevitParameterDesc ConnectorCoordinateSystem = new("Rvt:Connector:CoordinateSystem", ParameterType.String);
    public static RevitParameterDesc ConnectorOwner = new("Rvt:Connector:Owner", ParameterType.Entity);
    public static RevitParameterDesc ConnectorDirection = new("Rvt:Connector:Direction", ParameterType.String);
    public static RevitParameterDesc ConnectorIsConnected = new("Rvt:Connector:IsConnected", ParameterType.Int);
    public static RevitParameterDesc ConnectorIsMovable = new("Rvt:Connector:IsMovable", ParameterType.Int);
    public static RevitParameterDesc ConnectorGasketLength = new("Rvt:Connector:GasketLength", ParameterType.Number);

    // =========================
    // Piping System
    // =========================

    public static RevitParameterDesc PipingSystemTypeStr = new("Rvt:PipingSystem:PipingSystemType", ParameterType.String);

    /// <summary>
    /// Returns a UI friendly version of the parameter name
    /// </summary>
    public static string ParameterNameToUI(string name)
        => name.Substring(name.LastIndexOf(':') + 1);

    public static IEnumerable<RevitParameterDesc> GetParameters()
    {
        foreach (var fi in typeof(CommonRevitParameters).GetFields(
                     BindingFlags.Static | BindingFlags.Public))
        {
            var p = fi.GetValue(null) as RevitParameterDesc;
            if (p != null)
                yield return p;
        }
    }
}