"""Feature=DomainDesign, Size=Small, Maturity=Review; no production BIM claims."""
import copy
import json
import sys
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from build_domain_backlog import ROOT, build, load, markdown, models, validate


class DomainDesignSmallReviewTests(unittest.TestCase):
    def setUp(self):
        self.rows,self.policy,self.domains,self.workflows=load()

    def document(self):
        return build(self.rows,self.policy,self.domains,self.workflows)

    def test_hierarchical_json_has_valid_shape_and_matches_inputs(self):
        schema=json.loads((ROOT/'domain-models.schema.json').read_text(encoding='utf-8'))
        Draft202012Validator.check_schema(schema)
        document=self.document()
        Draft202012Validator(schema).validate(document)
        self.assertEqual(json.loads((ROOT/'domain-models.json').read_text(encoding='utf-8')),document)
        self.assertEqual((ROOT/'DOMAIN-QUEUE.md').read_text(encoding='utf-8'),markdown(document))

    def test_each_candidate_has_one_home_without_losing_crosscutting_tags(self):
        actual=models(self.document())
        self.assertCountEqual([r['id'] for r in self.rows],[r['id'] for r in actual])
        self.assertTrue(all(r['tags'] and r['roles'] and r['workflows'] for r in actual))

    def test_value_does_not_drop_because_a_useful_model_is_expensive(self):
        self.rows[0]['impact']='high'
        self.rows[0]['repeat_use']='frequent'
        self.rows[0]['scope_cost']='large'
        row=next(m for m in models(self.document()) if m['id']==self.rows[0]['id'])
        self.assertEqual(row['priority']['value'],'high')

    def test_infrequent_high_consequence_work_is_not_low_value(self):
        self.rows[0]['impact']='high'
        self.rows[0]['repeat_use']='rare'
        row=next(m for m in models(self.document()) if m['id']==self.rows[0]['id'])
        self.assertEqual(row['priority']['value'],'medium')

    def test_more_role_tags_do_not_inflate_value(self):
        before=models(self.document())[0]['priority']['value']
        row=next(r for r in self.rows if r['id']==models(self.document())[0]['id'])
        row['role_ids']=';'.join(r['id'] for r in self.workflows['roles'])
        self.assertEqual(models(self.document())[0]['priority']['value'],before)

    def test_an_unknown_workflow_is_rejected(self):
        self.rows[0]['workflow_ids']='imaginary_workflow'
        with self.assertRaisesRegex(ValueError,'Unknown candidate workflow'):
            self.document()

    def test_duplicate_candidate_is_rejected(self):
        self.rows.append(copy.deepcopy(self.rows[0]))
        with self.assertRaisesRegex(ValueError,'Duplicate candidate'):
            self.document()

    def test_active_design_budget_cannot_be_bypassed(self):
        self.policy['activeDesignLimit']=1
        self.assertGreater(len(self.policy['activeDesign']),1)
        with self.assertRaisesRegex(ValueError,'budget exceeded'):
            self.document()

    def test_incomplete_priority_matrix_is_rejected(self):
        self.policy['valueRules'].pop()
        with self.assertRaisesRegex(ValueError,'cover each'):
            self.document()

    def test_a_noun_without_a_decision_does_not_qualify(self):
        self.rows[0]['decision']=''
        with self.assertRaisesRegex(ValueError,'nonempty'):
            self.document()

    def test_activation_requires_a_review_question(self):
        self.policy['activeDesign'][0]['acceptanceQuestion']=''
        with self.assertRaisesRegex(ValueError,'Invalid active design'):
            self.document()

    def test_reuse_is_not_mistaken_for_another_model_to_build(self):
        row=next(m for m in models(self.document()) if m['id']=='requirement_assessment')
        self.assertEqual(row['existingContract']['tables'],['assessments'])
        self.assertEqual(row['priority']['nextAction'],'reuse_existing')

    def test_nonexistent_existing_table_is_rejected(self):
        self.policy['existingContractReview'][0]['tables']=['imaginary_table']
        with self.assertRaisesRegex(ValueError,'Unknown existing table'):
            self.document()

    def test_scenario_claim_must_name_actual_support(self):
        self.policy['scenarioSupport'][0]['scenarioId']='imaginary_scenario'
        with self.assertRaisesRegex(ValueError,'Unknown scenario support'):
            self.document()


if __name__=='__main__':
    unittest.main()
