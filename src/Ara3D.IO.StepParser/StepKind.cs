namespace Ara3D.IO.StepParser;

public enum StepKind 
{
    Id = 0,
    Entity = 1,
    Number = 2,
    List = 3,
    Redeclared = 4,
    Unassigned = 5,
    Symbol = 6,
    String = 7,
    Unknown = 8,
}