namespace Ara3D.BimOpenSchema.Federation;

/// <summary>The three SQL views <see cref="FederationStore"/> creates in schema "federation":
/// which source storeys merge into a federated group (<see cref="StoreyMembershipSql"/>), the
/// federated storeys themselves (<see cref="FederatedStoreySql"/>), and the federated storey of
/// every entity (<see cref="FederatedStoreyOfEntitySql"/>). The merge rule lives only in
/// <see cref="StoreyMembershipSql"/>; the other two views read it rather than recomputing it, so
/// there is one place to change it (plan Design item 5).</summary>
public static class FederationViews
{
    /// <summary>Decides, for every "storey" row in federation.correspondence, whether it merges
    /// into its group. A row merges when its status is Confirmed, or Candidate with no
    /// conflicts. A merged row keeps the group's canonical_key and canonical_name. Any other row
    /// gets its own key (canonical_key # source_document), its own name, and row_status Conflict
    /// when its status is Candidate, otherwise the status itself.</summary>
    public static readonly string StoreyMembershipSql = """
        CREATE OR REPLACE VIEW federation.StoreyMembership AS
        SELECT
            source_entity_index,
            source_document,
            source_name,
            CASE WHEN merged THEN canonical_key ELSE canonical_key || '#' || source_document END AS federated_storey_key,
            CASE WHEN merged THEN canonical_name ELSE source_name END AS federated_storey_name,
            merged,
            CASE
                WHEN merged THEN status
                WHEN status = 'Candidate' THEN 'Conflict'
                ELSE status
            END AS row_status
        FROM (
            SELECT *,
                   (status = 'Confirmed'
                       OR (status = 'Candidate' AND coalesce(array_length(conflicts), 0) = 0)) AS merged
            FROM federation.correspondence
            WHERE concept = 'storey'
        ) t
        """;

    /// <summary>One row per federated storey key. A merged group's status is Confirmed only when
    /// every member is Confirmed, otherwise Candidate; a standalone row keeps its own
    /// row_status. elevation_m is the group's median.</summary>
    public static readonly string FederatedStoreySql = """
        CREATE OR REPLACE VIEW federation.FederatedStorey AS
        SELECT
            sm.federated_storey_key,
            sm.federated_storey_name AS name,
            median(c.elevation_m) AS elevation_m,
            CASE
                WHEN bool_and(sm.merged) THEN
                    CASE WHEN bool_and(c.status = 'Confirmed') THEN 'Confirmed' ELSE 'Candidate' END
                ELSE any_value(sm.row_status)
            END AS status,
            count(DISTINCT sm.source_document) AS documents,
            array_agg(DISTINCT sm.source_name) AS members,
            list_distinct(flatten(array_agg(c.conflicts))) AS conflicts
        FROM federation.StoreyMembership sm
        JOIN federation.correspondence c
            ON c.concept = 'storey'
           AND c.source_entity_index = sm.source_entity_index
        GROUP BY sm.federated_storey_key, sm.federated_storey_name
        """;

    /// <summary>Every entity's federated storey, resolved through source_storey_of_entity (the
    /// nearest IFCBUILDINGSTOREY ancestor) and StoreyMembership (which group that ancestor
    /// belongs to), never recomputed here.</summary>
    public static readonly string FederatedStoreyOfEntitySql = """
        CREATE OR REPLACE VIEW federation.FederatedStoreyOfEntity AS
        SELECT
            se.entity_index,
            se.document,
            se.category,
            se.revit_category,
            ss.storey_index AS source_storey_index,
            sm.source_name AS source_storey_name,
            sm.federated_storey_key,
            sm.federated_storey_name,
            fs.status AS federated_storey_status,
            ss.depth
        FROM federation.source_entity se
        JOIN federation.source_storey_of_entity ss ON ss.entity_index = se.entity_index
        JOIN federation.StoreyMembership sm ON sm.source_entity_index = ss.storey_index
        JOIN federation.FederatedStorey fs ON fs.federated_storey_key = sm.federated_storey_key
        """;
}
