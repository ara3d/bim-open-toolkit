"""Review-document and small-fixture checks; not a production BIM validator."""
import json
from collections import Counter
from decimal import Decimal
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique(values, label):
    counts = Counter(values)
    require(all(n == 1 for n in counts.values()), f'Duplicate {label}')


def validate_shape(schema, value):
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(value)


def validate_documents(catalog=None, workflows=None, model=None):
    c = catalog if catalog is not None else read('model.catalog.json')
    w = workflows if workflows is not None else read('workflows.json')
    m = model if model is not None else read('model.schema.json')
    for schema in [m, read('catalog.schema.json'), read('workflows.schema.json')]:
        Draft202012Validator.check_schema(schema)
    validate_shape(read('catalog.schema.json'), c)
    validate_shape(read('workflows.schema.json'), w)
    require(c['version'] == w['version'] == w['contractVersion'], 'Contract version mismatch')
    require(c['modelSchema'] == 'model.schema.json' and c['workflowCatalog'] == 'workflows.json', 'Unexpected document link')
    for values, label in [(c['tables'], 'table'), (c['policies'], 'policy'), (c['invariants'], 'invariant'),
                          (w['roles'], 'role'), (w['workflows'], 'workflow')]:
        unique([x['id'] for x in values], label)
    tables = {t['id']: t for t in c['tables']}
    policies = {x['id'] for x in c['policies']}
    invariants = {x['id'] for x in c['invariants']}
    roles = {x['id'] for x in w['roles']}
    workflow_ids = {x['id'] for x in w['workflows']}
    fields = {}
    for t in tables.values():
        prefix, name = t['rowSchema'].split('#/$defs/')
        require(prefix == 'model.schema.json' and name in m['$defs'], f'Unknown row schema: {t["id"]}')
        fields[t['id']] = set(m['$defs'][name]['properties'])
        require(set(t['primaryKey']) <= fields[t['id']], f'Unknown primary key field: {t["id"]}')
        require(set(t['workflowIds']) <= workflow_ids, f'Unknown workflow for table: {t["id"]}')
        require(set(t['invariantIds']) <= invariants, f'Unknown invariant: {t["id"]}')
    envelopes = {x['properties']['table']['const']: x['properties']['row']['$ref'] for x in m['oneOf']}
    require(set(envelopes) == set(tables), 'Catalog/model table mismatch')
    for t in tables.values():
        require(envelopes[t['id']] == t['rowSchema'].split('model.schema.json')[1], 'Row schema mismatch')
        for fk in t['foreignKeys']:
            require(fk['field'] in fields[t['id']] and fk['targetTable'] in tables, 'Unknown foreign key')
            require(fk['targetField'] in fields[fk['targetTable']], 'Unknown foreign key target field')
            require((fk['scope'] == 'snapshot') == tables[fk['targetTable']]['snapshotScoped'], 'Foreign key scope mismatch')
    for wf in w['workflows']:
        require(set(wf['roleIds']) <= roles, f'Unknown role: {wf["id"]}')
        require(set(wf['policies']) <= policies, f'Unknown policy: {wf["id"]}')
        require(set(wf['requiredTables'] + wf['outputTables']) <= tables.keys(), f'Unknown workflow table: {wf["id"]}')
        unique([s['id'] for s in wf['steps']], f'step in {wf["id"]}')
        unique([p['id'] for p in wf['parameters']], f'parameter in {wf["id"]}')
        for field in wf['requiredFields']:
            table, column = field.split('.')
            require(table in wf['requiredTables'] and column in fields[table], f'Unknown workflow field: {field}')
        for step in wf['steps']:
            require(set(step['reads']) <= set(wf['requiredFields']), f'Undeclared step input: {wf["id"]}')
    for deferred in c['deferredConcepts']:
        require(set(deferred['workflowIds']) <= workflow_ids, 'Unknown deferred workflow')
    return c, w, m


def available(fact):
    return fact['state'] == 'available'


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def validate_fixture(pack, catalog=None, model=None):
    c = catalog if catalog is not None else read('model.catalog.json')
    m = model if model is not None else read('model.schema.json')
    require(pack['version'] == c['version'], 'Fixture version mismatch')
    require(pack['provenance'] == 'synthetic', 'Fixtures must be labeled synthetic')
    tables = {t['id']: t for t in c['tables']}
    data = pack['tables']
    require(set(data) == set(tables), 'Fixture must exercise every table')
    for name, rows in data.items():
        require(bool(rows), f'Empty fixture table: {name}')
        for row in rows:
            validate_shape(m, {'table': name, 'row': row})
        unique([tuple(r[k] for k in tables[name]['primaryKey']) for r in rows], f'primary key in {name}')
    snapshots = {r['id']: r for r in data['snapshots']}
    policy_ids = {p['id'] for p in c['policies']}
    for s in snapshots.values():
        require(set(s['policyIds']) <= policy_ids, 'Unknown snapshot policy')
    indexes = {}
    for name, table in tables.items():
        for fk in table['foreignKeys']:
            target = data[fk['targetTable']]
            key = (fk['targetTable'], fk['targetField'], fk['scope'])
            indexes[key] = {(r.get('snapshotId') if fk['scope'] == 'snapshot' else None, r[fk['targetField']]) for r in target}
        for row in data[name]:
            if table['snapshotScoped']:
                require(row['snapshotId'] in snapshots, 'Unknown snapshot')
            for fk in table['foreignKeys']:
                values = row[fk['field']] if fk['many'] else [row[fk['field']]]
                scope = row.get('snapshotId') if fk['scope'] == 'snapshot' else None
                for value in values:
                    require(value is None or (scope, value) in indexes[(fk['targetTable'], fk['targetField'], fk['scope'])], f'Dangling {name}.{fk["field"]}')
            for value in walk(row):
                if 'sourceRecordIds' in value:
                    for sid in value['sourceRecordIds']:
                        require(any(r['snapshotId'] == row.get('snapshotId') and r['id'] == sid for r in data['source_records']), 'Dangling source evidence')
                    require(set(value['referenceSetIds']) <= {r['id'] for r in data['reference_sets']}, 'Dangling reference evidence')
    def index(name, key='id'):
        return {(r['snapshotId'], r[key]): r for r in data[name]}
    states = index('object_states', 'objectId')
    frames = index('coordinate_frames')
    quantities = index('quantity_observations')
    contributions = index('material_contributions')
    representations = index('representations')
    scopes = index('quantity_scopes')
    packages = index('work_packages')
    refs = {r['id']: r for r in data['reference_sets']}
    objects = {r['id']: r for r in data['objects']}
    for row in data['source_records']:
        require(row['sourceRevisionId'] in snapshots[row['snapshotId']]['sourceRevisionIds'], 'Source revision outside snapshot')
    for row in data['source_links']:
        require(row['policyId'] in snapshots[row['snapshotId']]['policyIds'], 'Unselected identity policy')
        require((row['snapshotId'], row['objectId']) in states, 'Link has no object state in snapshot')
    for name, rows in data.items():
        for row in rows:
            for value in walk(row):
                if 'placeIds' in value:
                    for place in value['placeIds']:
                        target = states.get((row['snapshotId'], place))
                        require(target is not None and target['kind'] in {'project','site','building','storey','space','zone','terrain'}, 'Invalid spatial place')
                if 'coordinates' in value:
                    frame = frames.get((row['snapshotId'], value['frameId']))
                    require(frame is not None and frame['dimension'] == value['dimension'], 'Pose/frame dimension mismatch')
    for key, frame in frames.items():
        seen = {key}
        current = frame
        while current['parentFrameId'] is not None:
            parent_key = (key[0], current['parentFrameId'])
            require(parent_key not in seen, 'Frame cycle')
            seen.add(parent_key)
            current = frames[parent_key]
            require(current['dimension'] == frame['dimension'], 'Parent frame dimension mismatch')
        if frame['parentFrameId'] is None:
            require(frame['transformToParent'] is None, 'Root frame has parent transform')
    for row in data['spatial_bounds']:
        rep = representations[(row['snapshotId'], row['representationId'])]
        require(rep['objectId'] == row['objectId'], 'Bounds representation/object mismatch')
        require(frames[(row['snapshotId'], row['frameId'])]['dimension'] == row['dimension'], 'Bounds/frame dimension mismatch')
        require(all(Decimal(a) <= Decimal(b) for a,b in zip(row['min'], row['max'])), 'Inverted bounds')
    units = {'surface_area':{'m2'}, 'projected_area':{'m2'}, 'length':{'m'}, 'volume':{'m3'}, 'mass':{'kg'},
             'count':{'count'}, 'energy':{'kWh'}, 'power':{'kW'}, 'flow':{'L/s','m3/s'}}
    selected = []
    for q in quantities.values():
        require(scopes[(q['snapshotId'],q['scopeId'])]['objectId'] == q['objectId'], 'Quantity scope/object mismatch')
        require(q['selectionPolicyId'] in snapshots[q['snapshotId']]['policyIds'], 'Unselected quantity policy')
        if available(q['measurement']):
            value = q['measurement']['value']
            require(value['unit'] in units[q['quantityKind']], 'Quantity unit mismatch')
            require(Decimal(value['amount']) >= 0, 'Negative physical quantity')
        require((q['quantityKind'] == 'projected_area') == (q['basis'] == 'projected'), 'Quantity basis mismatch')
        if q['selectionState'] == 'selected':
            selected.append(tuple(q[k] for k in ['snapshotId','scopeId','quantityKind','basis','selectionPolicyId']))
    unique(selected, 'selected quantity in same context')
    for row in data['component_schedule']:
        state = states[(row['snapshotId'], row['objectId'])]
        require(objects[row['objectId']]['identityDomain'] == 'physical' and row['kind'] == state['kind'], 'Nonphysical/inconsistent component schedule')
    for table, kind in [('door_schedule','door'),('roof_takeoff','roof')]:
        for row in data[table]:
            require(states[(row['snapshotId'],row['objectId'])]['kind'] == kind, 'Schedule/object kind mismatch')
    for row in data['roof_takeoff']:
        if row['netSurfaceQuantityId'] is not None:
            q = quantities[(row['snapshotId'], row['netSurfaceQuantityId'])]
            require(q['objectId'] == row['objectId'] and q['quantityKind'] == 'surface_area' and q['basis'] == 'net', 'Roof quantity context mismatch')
            if available(row['netSurfaceArea']):
                require(q['selectionState'] == 'selected', 'Roof uses unselected quantity')
            require(q['measurement'] == row['netSurfaceArea'], 'Roof quantity projection differs')
        else:
            require(not available(row['netSurfaceArea']), 'Available roof quantity has no observation')
    unique([(r['snapshotId'],r['surfaceIdentity']) for r in data['finish_schedule']], 'finish surface')
    for row in data['finish_schedule']:
        if available(row['space']):
            space = states.get((row['snapshotId'], row['space']['value']))
            require(space is not None and space['kind'] == 'space', 'Finish target is not a space')
    for row in data['material_contributions']:
        require(objects[row['materialId']]['identityDomain'] == 'material', 'Contribution material is not material identity')
        require(quantities[(row['snapshotId'],row['quantityObservationId'])]['objectId'] == row['objectId'], 'Contribution quantity/object mismatch')
    for row in data['assessments']:
        require(refs[row['requirementSetId']]['kind'] == 'requirements', 'Assessment reference kind mismatch')
    for row in data['estimate_lines']:
        if row['rateSetId'] is not None:
            require(refs[row['rateSetId']]['kind'] == 'rates', 'Rate reference kind mismatch')
        require(Decimal(row['wasteFraction']) >= 0, 'Negative waste fraction')
        q = quantities[(row['snapshotId'],row['quantityObservationId'])]
        require(q['objectId'] in packages[(row['snapshotId'],row['workPackageId'])]['objectIds'], 'Estimate quantity outside work package')
        if row['status'] == 'priced':
            require(q['selectionState'] == 'selected' and available(q['measurement']), 'Priced line lacks selected quantity')
            require(row['unitRate']['value']['perUnit'] == q['measurement']['value']['unit'], 'Rate unit mismatch')
            require(row['unitRate']['value']['currency'] == row['totalCost']['value']['currency'], 'Currency mismatch')
    for row in data['impact_lines']:
        if row['factorSetId'] is not None:
            require(refs[row['factorSetId']]['kind'] == 'environmental_factors', 'Factor reference kind mismatch')
        part = contributions[(row['snapshotId'],row['materialContributionId'])]
        q = quantities[(row['snapshotId'],part['quantityObservationId'])]
        if row['status'] == 'calculated':
            require(part['accountingRole'] == 'leaf_contribution', 'Impact requires leaf contribution')
            require(q['selectionState'] == 'selected' and available(q['measurement']), 'Impact lacks selected quantity')
            require(row['factorPerUnit'] == q['measurement']['value']['unit'], 'Factor unit mismatch')
    unique([(r['snapshotId'],r['materialContributionId'],r['scenarioId'],r['module']) for r in data['impact_lines']], 'impact contribution/scenario/module')
    return sum(len(rows) for rows in data.values())


if __name__ == '__main__':
    catalog, workflows, model = validate_documents()
    count = validate_fixture(read('examples/scenarios.json'), catalog, model)
    print(f'Valid: {len(catalog["tables"])} table contracts, {len(workflows["roles"])} roles, '
          f'{len(workflows["workflows"])} workflows, {count} synthetic records.')
