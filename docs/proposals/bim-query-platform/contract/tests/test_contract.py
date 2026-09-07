"""Small synthetic review tests. Class names are feature/category selectors."""
import copy
import unittest
from decimal import Decimal

from jsonschema import ValidationError
from validate_contract import read, validate_documents, validate_fixture, validate_shape


class DocumentsSmallReviewTests(unittest.TestCase):
    def test_documents_are_valid_and_linked(self):
        validate_documents()

    def test_workflow_field_typo_is_rejected(self):
        w = read('workflows.json')
        w['workflows'][0]['requiredFields'].append('roof_takeoff.magicArea')
        with self.assertRaisesRegex(ValueError, 'Unknown workflow field'):
            validate_documents(workflows=w)

    def test_unknown_role_is_rejected(self):
        w = read('workflows.json')
        w['workflows'][0]['roleIds'].append('imaginary_role')
        with self.assertRaisesRegex(ValueError, 'Unknown role'):
            validate_documents(workflows=w)

    def test_version_drift_is_rejected(self):
        c = read('model.catalog.json')
        c['version'] = 'different'
        with self.assertRaisesRegex(ValueError, 'version mismatch'):
            validate_documents(catalog=c)


class ShapeSmallReviewTests(unittest.TestCase):
    def setUp(self):
        self.model = read('model.schema.json')
        self.tables = read('examples/scenarios.json')['tables']

    def reject(self, table, row):
        with self.assertRaises(ValidationError):
            validate_shape(self.model, {'table': table, 'row': row})

    def test_missing_quantity_cannot_be_encoded_as_zero(self):
        row = self.tables['roof_takeoff'][1]
        row['netSurfaceArea']['value'] = {'amount':'0', 'unit':'m2'}
        self.reject('roof_takeoff', row)

    def test_surface_area_rejects_length_unit(self):
        row = self.tables['roof_takeoff'][0]
        row['netSurfaceArea']['value']['unit'] = 'm'
        self.reject('roof_takeoff', row)

    def test_incomplete_assessment_cannot_pass(self):
        row = self.tables['assessments'][0]
        row['result'] = 'pass'
        self.reject('assessments', row)

    def test_invalid_reference_date_is_rejected(self):
        row = self.tables['reference_sets'][0]
        row['effectiveDate'] = '2026-02-30'
        self.reject('reference_sets', row)

    def test_unknown_field_is_rejected(self):
        row = self.tables['door_schedule'][0]
        row['fireRaing'] = 'typo'
        self.reject('door_schedule', row)

    def test_bounds_dimension_is_enforced(self):
        row = self.tables['spatial_bounds'][0]
        row['min'] = ['0']
        self.reject('spatial_bounds', row)


class SemanticsSmallReviewTests(unittest.TestCase):
    def setUp(self):
        self.pack = read('examples/scenarios.json')
        self.tables = self.pack['tables']

    def reject(self, message):
        with self.assertRaisesRegex(ValueError, message):
            validate_fixture(self.pack)

    def test_all_fixture_tables_and_references_are_valid(self):
        self.assertGreater(validate_fixture(self.pack), 0)

    def test_duplicate_identity_key_is_rejected(self):
        self.tables['objects'].append(copy.deepcopy(self.tables['objects'][0]))
        self.reject('Duplicate primary key')

    def test_cross_snapshot_join_is_rejected(self):
        s = copy.deepcopy(self.tables['snapshots'][0])
        s['id'] = 'another-snapshot'
        self.tables['snapshots'].append(s)
        self.tables['door_schedule'][0]['snapshotId'] = s['id']
        self.reject('Dangling door_schedule.objectId')

    def test_dangling_evidence_is_rejected(self):
        self.tables['object_states'][0]['evidence']['sourceRecordIds'] = ['missing']
        self.reject('Dangling source evidence')

    def test_two_selected_alternatives_are_rejected(self):
        q = next(x for x in self.tables['quantity_observations'] if x['selectionState'] == 'alternative')
        q['selectionState'] = 'selected'
        self.reject('Duplicate selected quantity')

    def test_projected_area_cannot_replace_net_surface(self):
        row = self.tables['roof_takeoff'][0]
        row['netSurfaceQuantityId'] = 'quantity-roof-projected'
        self.reject('Roof quantity context mismatch')

    def test_duplicate_room_association_cannot_double_surface(self):
        row = copy.deepcopy(self.tables['finish_schedule'][0])
        row['id'] = 'duplicate-face-other-space'
        row['space']['value'] = 'room-south'
        self.tables['finish_schedule'].append(row)
        self.reject('Duplicate finish surface')

    def test_mismatched_rate_unit_is_rejected(self):
        self.tables['estimate_lines'][0]['unitRate']['value']['perUnit'] = 'kg'
        self.reject('Rate unit mismatch')

    def test_estimate_cannot_price_another_packages_object(self):
        self.tables['work_packages'][0]['objectIds'] = ['beam']
        self.reject('Estimate quantity outside work package')

    def test_distinct_material_parts_can_have_selected_masses(self):
        q = next(r for r in self.tables['quantity_observations'] if r['id']=='quantity-steel')
        original_scope = next(r for r in self.tables['quantity_scopes'] if r['id']==q['scopeId'])
        original_scope['kind'] = 'material_part'
        scope = copy.deepcopy(original_scope)
        scope['id'] = 'second-material-part'
        scope['description'] = 'Distinct coating part of beam; scope disjointness needs evidence in a real model.'
        self.tables['quantity_scopes'].append(scope)
        second = copy.deepcopy(q)
        second['id'] = 'second-material-mass'
        second['scopeId'] = scope['id']
        second['measurement']['value']['amount'] = '5'
        self.tables['quantity_observations'].append(second)
        validate_fixture(self.pack)

    def test_unassigned_finish_is_retained(self):
        row = self.tables['finish_schedule'][0]
        row['space'] = {'state':'not_observed','reason':'No room association supplied.',
                        'evidence':row['space']['evidence']}
        row['surfaceSide'] = None
        validate_fixture(self.pack)

    def test_missing_factor_does_not_require_invented_values(self):
        row = self.tables['impact_lines'][0]
        row['status'] = 'incomplete'
        for key in ['factorSetId','factorItemId','factorAmount','factorPerUnit']:
            row[key] = None
        row['impact'] = {'state':'not_observed','reason':'No factor matched.', 'evidence':row['impact']['evidence']}
        validate_fixture(self.pack)

    def test_mismatched_currency_is_rejected(self):
        self.tables['estimate_lines'][0]['totalCost']['value']['currency'] = 'USD'
        self.reject('Currency mismatch')

    def test_factor_denominator_is_checked(self):
        self.tables['impact_lines'][0]['factorPerUnit'] = 'm3'
        self.reject('Factor unit mismatch')

    def test_alternative_factor_not_additive_in_same_scenario(self):
        row = copy.deepcopy(self.tables['impact_lines'][0])
        row['id'] = 'alternative-factor-line'
        self.tables['impact_lines'].append(row)
        self.reject('Duplicate impact contribution')

    def test_frame_cycle_is_rejected(self):
        row = self.tables['coordinate_frames'][0]
        row['parentFrameId'] = row['id']
        self.reject('Frame cycle')

    def test_inverted_bounds_are_rejected(self):
        row = self.tables['spatial_bounds'][0]
        row['min'][0] = '1000000'
        self.reject('Inverted bounds')

    def test_logical_system_is_not_a_countable_component(self):
        row = self.tables['component_schedule'][0]
        identity = next(x for x in self.tables['objects'] if x['id'] == row['objectId'])
        identity['identityDomain'] = 'logical'
        self.reject('Nonphysical/inconsistent component')


class WorkflowSmallReviewTests(unittest.TestCase):
    """Explicit examples of intended answers, not execution of workflow pseudo-code."""
    def setUp(self):
        pack = read('examples/scenarios.json')
        self.d = pack['tables']
        self.expected = {x['id']: x['expected'] for x in pack['scenarios']}
        self.q = {x['id']: x for x in self.d['quantity_observations']}

    def check(self, scenario, actual):
        self.assertEqual(actual, self.expected[scenario])

    def test_roof_surface_projection_and_unmeasured_scope(self):
        known = [r for r in self.d['roof_takeoff'] if r['netSurfaceArea']['state'] == 'available']
        alternative = next(q for q in self.q.values() if q['selectionState'] == 'alternative')
        self.check('roof-surface-versus-projection', {
            'selectedSurfaceArea':str(sum(Decimal(r['netSurfaceArea']['value']['amount']) for r in known)),
            'projectedArea':str(sum(Decimal(r['projectedArea']['value']['amount']) for r in known)),
            'alternativeSurfaceArea':alternative['measurement']['value']['amount'], 'areaUnit':'m2',
            'unmeasuredRoofCount':len(self.d['roof_takeoff'])-len(known),
            'roofCount':len({r['objectId'] for r in self.d['roof_takeoff']})})

    def test_finishes_are_measured_per_face(self):
        rows = self.d['finish_schedule']
        self.check('shared-wall-faces', {'wallObjectCount':len({r['objectId'] for r in rows}),
            'surfaceCount':len({r['surfaceIdentity'] for r in rows}),
            'areaBySpace':{r['space']['value']:r['netArea']['value']['amount'] for r in rows},
            'finishBySpace':{r['space']['value']:r['finish']['value'] for r in rows}, 'areaUnit':'m2'})

    def test_estimate_subtotal_preserves_unpriced_scope(self):
        priced = [r for r in self.d['estimate_lines'] if r['status'] == 'priced']
        subtotal = Decimal(0)
        for r in priced:
            amount = Decimal(self.q[r['quantityObservationId']]['measurement']['value']['amount'])
            calculated = amount * Decimal(r['unitRate']['value']['amount']) * (1 + Decimal(r['wasteFraction']))
            self.assertEqual(calculated, Decimal(r['totalCost']['value']['amount']))
            subtotal += calculated
        self.check('priced-and-unpriced-scope', {'pricedSubtotal':format(subtotal, '.0f'),
            'currency':priced[0]['totalCost']['value']['currency'], 'pricedLineCount':len(priced),
            'unpricedLineCount':sum(r['status'] == 'unpriced' for r in self.d['estimate_lines']),
            'wasteFraction':priced[0]['wasteFraction']})

    def test_door_audit_cannot_claim_complete_evidence(self):
        assessment = next(r for r in self.d['assessments'] if r['id'] == 'audit-door')
        door = self.d['door_schedule'][0]
        self.check('missing-door-evidence', {'assessmentId':assessment['id'],'result':assessment['result'],
            'inputCompleteness':assessment['inputCompleteness'], 'clearWidthState':door['clearWidth']['state'],
            'fireRatingState':door['fireRating']['state']})

    def test_trace_uses_accepted_topology_and_ignores_proximity(self):
        allowed = {'connects_to','serves'}
        visited, todo = set(), ['ahu']
        while todo:
            source = todo.pop()
            for r in self.d['relationships']:
                if r['sourceObjectId'] == source and r['status'] == 'accepted' and r['kind'] in allowed:
                    if r['targetObjectId'] not in visited:
                        visited.add(r['targetObjectId'])
                        todo.append(r['targetObjectId'])
        candidates = [r for r in self.d['relationships'] if r['status'] == 'candidate']
        self.check('supported-mep-only', {'startObjectId':'ahu', 'acceptedKinds':sorted(allowed),
            'reachableObjectIds':sorted(visited), 'excludedObjectIds':sorted({r['targetObjectId'] for r in candidates}-visited),
            'candidateEdgeIds':sorted(r['id'] for r in candidates)})

    def test_material_impact_counts_contribution_once(self):
        contribution = self.d['material_contributions'][0]
        impact = self.d['impact_lines'][0]
        value = self.q[contribution['quantityObservationId']]['measurement']['value']
        calculated = Decimal(value['amount']) * Decimal(impact['factorAmount'])
        self.assertEqual(calculated, Decimal(impact['impact']['value']['amount']))
        oid = contribution['objectId']
        self.check('deduplicated-material-impact', {'objectId':oid,
            'sourceRecordCount':len({r['sourceRecordId'] for r in self.d['source_links'] if r['objectId']==oid and r['matchState']=='confirmed'}),
            'representationCount':sum(r['objectId']==oid for r in self.d['representations']),
            'materialContributionCount':sum(r['objectId']==oid for r in self.d['material_contributions']),
            'selectedMass':value['amount'],'massUnit':value['unit'],'factorAmount':impact['factorAmount'],
            'impact':str(calculated),'impactUnit':impact['impact']['value']['unit'],'module':impact['module']})

    def test_egress_readiness_remains_unknown(self):
        row = next(r for r in self.d['assessments'] if r['id']=='audit-egress')
        self.check('egress-input-gap', {'assessmentId':row['id'],'result':row['result'],
            'inputCompleteness':row['inputCompleteness'],
            'navigableRouteEstablished':row['result']=='pass' and row['inputCompleteness']=='complete'})

    def test_handover_keeps_asset_with_missing_manual(self):
        asset = self.d['asset_register'][0]
        row = next(r for r in self.d['assessments'] if r['id']=='audit-manual')
        self.check('asset-without-manual', {'objectId':asset['objectId'],'assetCount':len(self.d['asset_register']),
            'maintainable':asset['maintainability']['value'],'manualsState':asset['manuals']['state'],
            'assessmentId':row['id'],'result':row['result'],'inputCompleteness':row['inputCompleteness']})


if __name__ == '__main__':
    unittest.main()
