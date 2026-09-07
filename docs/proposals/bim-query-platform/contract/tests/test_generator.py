"""Generator tests: feature=Generation, size=Small, maturity=Review. No dependencies."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from generate_records import Generator, ROOT


class GenerationSmallReviewTests(unittest.TestCase):
    def test_committed_output_is_current_and_deterministic(self):
        expected = (ROOT/'generated'/'BimDataModel.cs').read_text(encoding='utf-8')
        self.assertEqual(Generator().render(), expected)
        self.assertEqual(Generator().render(), expected)

    def test_all_tables_appear_once_with_domain_and_grain(self):
        generator = Generator()
        output = generator.render()
        for table in generator.tables.values():
            self.assertEqual(output.count('public sealed record '+generator.names[table['id']]+'('), 1)
            self.assertIn('Table: '+table['id']+'. Row grain:', output)
        for domain in generator.domains:
            self.assertIn('// '+domain['name']+'\n', output)
            self.assertIn('// '+domain['meaning']+'\n', output)

    def test_references_nullable_collections_and_value_unions(self):
        output = Generator().render()
        for declaration in [
            'ReferenceKey<Snapshot> SnapshotId',
            'ReferenceKey<BimObject> ObjectId',
            'SnapshotReferenceKey<CoordinateFrame>? ParentFrameId',
            'ImmutableArray<SnapshotReferenceKey<SourceRecord>> SourceRecordIds',
            'Fact<SnapshotReferenceKey<ObjectState>> Space',
            'public abstract record ScalarValue',
            'public sealed record Integer(',
            'BigInteger Value',
            'public sealed record Missing(Unavailable Detail)',
        ]:
            self.assertIn(declaration, output)

    def test_new_schema_field_changes_generated_signature(self):
        generator = Generator()
        generator.defs['RoofTakeoff']['properties']['reviewLabel'] = {'type':'string','description':'A test-only label.'}
        generator.defs['RoofTakeoff']['required'].append('reviewLabel')
        output = generator.render()
        self.assertIn('string ReviewLabel',output)
        self.assertIn('A test-only label.',output)

    def test_unsupported_union_fails_instead_of_using_object(self):
        generator = Generator()
        generator.defs['RoofTakeoff']['properties']['ambiguous'] = {'oneOf':[{'type':'string'},{'type':'boolean'}]}
        with self.assertRaisesRegex(ValueError,'Unsupported undiscriminated union'):
            generator.render()

    def test_enum_name_collision_is_rejected(self):
        generator = Generator()
        generator.defs['ObjectKind']['enum'] = ['a-b','a_b']
        with self.assertRaisesRegex(ValueError,'enum member'):
            generator.render()

    def test_missing_primary_domain_is_rejected(self):
        generator = Generator()
        generator.memberships = [r for r in generator.memberships if r['table_id']!='roof_takeoff']
        with self.assertRaisesRegex(ValueError,'exactly one primary domain'):
            generator.validate_catalogs()

    def test_candidate_cannot_reference_an_undefined_table(self):
        generator = Generator()
        generator.concepts[0]['table_ids'] = 'uncontracted_table'
        with self.assertRaisesRegex(ValueError,'Unknown concept table'):
            generator.validate_catalogs()

    def test_nested_reference_must_match_scope(self):
        generator = Generator()
        generator.refs[0]['scope']='global'
        with self.assertRaisesRegex(ValueError,'scope mismatch'):
            generator.validate_catalogs()

    def test_xml_documentation_is_escaped(self):
        generator = Generator()
        generator.defs['RoofTakeoff']['description']='Area < gross & not a <tag>.'
        self.assertIn('Area &lt; gross &amp; not a &lt;tag&gt;.',generator.render())

    def test_multiline_descriptions_remain_comments(self):
        generator = Generator()
        generator.domains[0]['meaning']='First line\npublic sealed record Unexpected();'
        generator.defs['RoofTakeoff']['description']='First line\npublic sealed record UnexpectedXml();'
        output=generator.render()
        self.assertIn('\n// public sealed record Unexpected();',output)
        self.assertIn('\n/// public sealed record UnexpectedXml();',output)
        self.assertNotIn('\npublic sealed record Unexpected',output)

    def test_reference_override_cannot_hide_incompatible_field_type(self):
        generator = Generator()
        generator.defs['DoorSchedule']['properties']['objectId']={'type':'boolean'}
        with self.assertRaisesRegex(ValueError,'identifier shape'):
            generator.render()

    def test_record_cannot_silently_become_existing_enum(self):
        generator = Generator()
        generator.names['roof_takeoff']='Unit'
        generator.definition_names['RoofTakeoff']='Unit'
        with self.assertRaisesRegex(ValueError,'collision'):
            generator.render()

    def test_generic_number_requires_an_explicit_precision_mapping(self):
        generator = Generator()
        generator.defs['RoofTakeoff']['properties']['newMeasure']={'type':'number'}
        with self.assertRaisesRegex(ValueError,'Unsupported schema shape'):
            generator.render()


if __name__ == '__main__':
    unittest.main()
