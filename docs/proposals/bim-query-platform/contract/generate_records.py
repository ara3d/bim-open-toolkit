"""Generate a documented C# review model from the contract. Standard library only.

This is a deliberately bounded schema projection, not a JSON serializer or validator.
Unsupported shapes fail rather than becoming object/dynamic. Inputs are authoritative;
the generated file is reproducible and must not be edited independently.
"""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent
INPUTS = ('model.schema.json', 'model.catalog.json', 'domains.csv', 'concepts.csv',
          'table_domains.csv', 'records.csv', 'references.csv')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def pascal(value):
    result = ''.join(x[0].upper() + x[1:] for x in re.findall(r'[A-Za-z0-9]+', value))
    if result and result[0].isdigit():
        result = 'Value' + result
    require(bool(result), f'Cannot form a C# identifier from {value!r}')
    return result


def pointer(document, path):
    result = document
    for part in path.removeprefix('/').split('/'):
        key = part.replace('~1', '/').replace('~0', '~')
        result = result[int(key)] if isinstance(result, list) else result[key]
    return result


def csv_rows(root, name, columns):
    with (root / name).open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        require(reader.fieldnames == columns, f'{name}: expected columns {columns}')
        rows = list(reader)
    for row in rows:
        require(None not in row and all(v is not None for v in row.values()), f'{name}: malformed row')
    return rows


def unique(values, label):
    require(len(values) == len(set(values)), f'Duplicate {label}')


def doc(value):
    """Escape XML documentation and keep every input line inside a C# comment."""
    return '\n/// '.join(escape(str(value)).splitlines())


def comment(value):
    return '\n// '.join(str(value).splitlines())


class Generator:
    def __init__(self, root=ROOT):
        self.root = Path(root)
        self.schema = json.loads((self.root / 'model.schema.json').read_text(encoding='utf-8'))
        self.catalog = json.loads((self.root / 'model.catalog.json').read_text(encoding='utf-8'))
        self.tables = {t['id']:t for t in self.catalog['tables']}
        unique([t['id'] for t in self.catalog['tables']], 'table ID')
        self.defs = self.schema['$defs']
        self.domains = csv_rows(self.root, 'domains.csv', ['id','name','meaning'])
        self.concepts = csv_rows(self.root, 'concepts.csv', ['domain_id','name','meaning','status','table_ids'])
        self.memberships = csv_rows(self.root, 'table_domains.csv', ['table_id','domain_id','primary'])
        bindings = csv_rows(self.root, 'records.csv', ['table_id','record_name'])
        self.refs = csv_rows(self.root, 'references.csv', ['schema_path','target_table','scope','many','meaning'])
        unique([r['table_id'] for r in bindings], 'record table binding')
        unique([r['record_name'] for r in bindings], 'record name')
        self.names = {r['table_id']:r['record_name'] for r in bindings}
        require(set(self.names) == set(self.tables), 'Record bindings must cover every table exactly once')
        for name in self.names.values():
            require(re.fullmatch(r'[A-Z][A-Za-z0-9]*', name), f'Invalid C# record name: {name}')
        self.definition_names = {t['rowSchema'].split('/')[-1]: self.names[t['id']] for t in self.tables.values()}
        self.table_defs = {t['rowSchema'].split('/')[-1]: t for t in self.tables.values()}
        self.validate_catalogs()
        self.overrides = {}
        for t in self.tables.values():
            path = '/' + t['rowSchema'].split('#/')[1]
            self.overrides[path + '/properties/snapshotId'] = ('snapshots','global',False)
            for fk in t['foreignKeys']:
                target = self.tables[fk['targetTable']]
                target_key = [k for k in target['primaryKey'] if k != 'snapshotId']
                require(target_key == [fk['targetField']], f'Unsupported non-key reference: {t["id"]}.{fk["field"]}')
                self.overrides[path + '/properties/' + fk['field']] = (fk['targetTable'],fk['scope'],fk['many'])
            for key in t['primaryKey']:
                self.overrides.setdefault(path + '/properties/' + key, (t['id'],'global',False))
        for ref in self.refs:
            require(ref['schema_path'] not in self.overrides, 'Reference declared in two sources')
            self.overrides[ref['schema_path']] = (ref['target_table'],ref['scope'],ref['many']=='true')
        self.declarations = {}
        self.in_progress = set()
        self.aliases = {'Id':'string', 'Decimal':'DecimalText'}
        self.enums = {}
        self.fact_assurance = None

    def validate_catalogs(self):
        domain_ids = [d['id'] for d in self.domains]
        unique(domain_ids, 'domain ID')
        require(all(d['id'] and d['name'] and d['meaning'] for d in self.domains), 'Empty domain definition')
        unique([(c['domain_id'],c['name']) for c in self.concepts], 'concept within domain')
        for c in self.concepts:
            require(c['domain_id'] in domain_ids and c['name'] and c['meaning'], 'Invalid concept domain/meaning')
            require(c['status'] in {'represented','partial','candidate'}, 'Invalid concept status')
            tables = c['table_ids'].split(';') if c['table_ids'] else []
            require(set(tables) <= self.tables.keys(), f'Unknown concept table: {c["name"]}')
            require(c['status'] == 'candidate' or tables, 'Represented/partial concept needs a table mapping')
        unique([(r['table_id'],r['domain_id']) for r in self.memberships], 'table/domain membership')
        for row in self.memberships:
            require(row['table_id'] in self.tables and row['domain_id'] in domain_ids, 'Unknown table/domain membership')
            require(row['primary'] in {'true','false'}, 'Invalid primary flag')
        for table in self.tables:
            require(sum(r['table_id']==table and r['primary']=='true' for r in self.memberships)==1,
                    f'Table {table} must have exactly one primary domain')
        memberships={(r['table_id'],r['domain_id']) for r in self.memberships}
        for concept in self.concepts:
            for table in filter(None,concept['table_ids'].split(';')):
                require((table,concept['domain_id']) in memberships, 'Concept table is missing its domain membership')
        unique([r['schema_path'] for r in self.refs], 'nested reference path')
        for row in self.refs:
            require(row['target_table'] in self.tables, 'Unknown nested reference target')
            require(row['scope'] in {'global','snapshot'} and row['many'] in {'true','false'}, 'Invalid reference cardinality/scope')
            require((row['scope']=='snapshot') == self.tables[row['target_table']]['snapshotScoped'], 'Nested reference scope mismatch')
            try:
                shape = pointer(self.schema, row['schema_path'])
            except (KeyError, IndexError, ValueError) as error:
                raise ValueError(f'Unknown reference path: {row["schema_path"]}') from error
            require((shape.get('type')=='array') == (row['many']=='true'), 'Nested reference cardinality mismatch')
        for table in self.tables.values():
            definition = table['rowSchema'].split('/')[-1]
            require(definition in self.defs, 'Unknown table definition')
            properties = self.defs[definition]['properties']
            require(set(table['primaryKey']) <= properties.keys(), 'Unknown primary-key field')
            expected = ['snapshotId'] if table['snapshotScoped'] else []
            require(table['primaryKey'][:len(expected)]==expected and len(table['primaryKey'])==len(expected)+1,
                    'Only one local key, optionally scoped by snapshot, is supported')
            for fk in table['foreignKeys']:
                require(fk['field'] in properties and fk['targetTable'] in self.tables, 'Invalid foreign-key metadata')
                require((fk['scope']=='snapshot')==self.tables[fk['targetTable']]['snapshotScoped'], 'Foreign-key scope mismatch')

    @staticmethod
    def nullable(shape):
        return ('null' in shape.get('type', []) or
                any(x.get('type')=='null' for x in shape.get('anyOf', [])))

    def reference_type(self, path, shape):
        target, scope, many = self.overrides[path]
        core = shape
        if 'anyOf' in core:
            nonnull = [x for x in core['anyOf'] if x.get('type')!='null']
            require(len(core['anyOf'])==2 and len(nonnull)==1, f'Unsupported reference union: {path}')
            core = nonnull[0]
        if isinstance(core.get('type'),list):
            require(set(core['type'])=={'string','null'}, f'Invalid reference type union: {path}')
            core = {**core,'type':'string'}
        require((core.get('type')=='array')==many, f'Reference cardinality mismatch: {path}')
        if many:
            core = core['items']
        require(core.get('$ref')=='#/$defs/Id' or core.get('type')=='string', f'Reference must have identifier shape: {path}')
        type_name = ('SnapshotReferenceKey' if scope=='snapshot' else 'ReferenceKey') + '<' + self.names[target] + '>'
        if many:
            type_name = f'ImmutableArray<{type_name}>'
        return type_name + ('?' if self.nullable(shape) else '')

    def emit_enum(self, name, values):
        signature = tuple((type(v).__name__, str(v)) for v in values)
        if signature in self.enums:
            return self.enums[signature]
        require(all(isinstance(v,str) for v in values) or all(type(v) is int for v in values), 'Unsupported enum values')
        members = [pascal(str(v)) for v in values]
        unique(members, f'enum member after C# naming in {name}')
        lines = [f'/// <summary>Allowed values from the contract; C# names are presentation names.</summary>',f'public enum {name}', '{']
        for member, value in zip(members,values):
            lines.append('    /// <summary>Contract value: ' + doc(value) + '.</summary>')
            lines.append(f'    {member}' + (f' = {value}' if type(value) is int else '') + ',')
        lines.append('}')
        self.add(name, '\n'.join(lines))
        self.enums[signature] = name
        return name

    def add(self, name, text):
        require(name not in self.declarations, f'Generated type name collision: {name}')
        require(name not in {'ReferenceKey','SnapshotReferenceKey','DecimalText','Fact'}, f'Reserved helper type: {name}')
        self.declarations[name] = text

    def type_of(self, shape, hint, path):
        if path in self.overrides:
            return self.reference_type(path, shape)
        if '$ref' in shape:
            require(shape['$ref'].startswith('#/$defs/'), f'Unsupported external schema reference: {path}')
            return self.definition(shape['$ref'].split('/')[-1])
        if 'enum' in shape:
            return self.emit_enum(hint, shape['enum'])
        if 'anyOf' in shape and 'type' not in shape:
            branches = [x for x in shape['anyOf'] if x.get('type')!='null']
            require(len(branches)==1 and len(shape['anyOf'])==2, f'Unsupported union: {path}')
            return self.type_of(branches[0], hint, path+'/anyOf/'+str(shape['anyOf'].index(branches[0])))+'?'
        typ = shape.get('type')
        if isinstance(typ,list):
            require(len(typ)==2 and 'null' in typ, f'Unsupported type union: {path}')
            return self.type_of({**shape,'type':next(x for x in typ if x!='null')}, hint, path+'/nonnull')+'?'
        if typ in {'string','boolean','integer'}:
            return {'string':'string','boolean':'bool','integer':'BigInteger'}[typ]
        if typ == 'array':
            return 'ImmutableArray<' + self.type_of(shape['items'],hint+'Item',path+'/items') + '>'
        if typ == 'object':
            self.record(hint, shape, path)
            return hint
        if 'oneOf' in shape:
            return self.union(hint,shape,path)
        raise ValueError(f'Unsupported schema shape at {path}: {shape}')

    def definition(self, name):
        if name in self.aliases:
            return self.aliases[name]
        require(name in self.defs, f'Unknown definition: {name}')
        type_name = self.definition_names.get(name,name)
        if name in self.in_progress:
            return type_name
        self.in_progress.add(name)
        result = self.type_of(self.defs[name],type_name,'/$defs/'+name)
        self.in_progress.remove(name)
        self.aliases[name] = result
        return result

    def union(self, name, shape, path):
        cases = shape['oneOf']
        # All availability wrappers have the same algebraic structure.
        if len(cases)==2 and cases[1]=={'$ref':'#/$defs/Unavailable'}:
            available = cases[0]
            props = available.get('properties',{})
            require(set(props)=={'state','value','assurance','evidence'} and props['state']=={'const':'available'},
                    f'Unsupported availability wrapper: {path}')
            require(set(available['required'])==set(props) and props['evidence']=={'$ref':'#/$defs/Evidence'}, 'Unsupported fact evidence/required shape')
            assurance = self.type_of(props['assurance'],'Assurance',path+'/oneOf/0/properties/assurance')
            require(self.fact_assurance in {None,assurance}, 'Fact assurance vocabularies differ')
            self.fact_assurance = assurance
            self.definition('Evidence')
            self.definition('Unavailable')
            value = self.type_of(props['value'],name+'Value',path+'/oneOf/0/properties/value')
            return 'Fact<' + value + '>'
        # Other unions need an explicit, distinct kind discriminator.
        kinds=[]
        for case in cases:
            require(case.get('type')=='object' and 'const' in case.get('properties',{}).get('kind',{}),
                    f'Unsupported undiscriminated union: {path}')
            kinds.append(case['properties']['kind']['const'])
        unique(kinds, 'union kind')
        unique([pascal(k) for k in kinds], 'union case C# name')
        lines=[f'/// <summary>Closed alternatives from {doc(path)}.</summary>',f'public abstract record {name}','{',f'    private {name}() {{ }}']
        for i,(kind,case) in enumerate(zip(kinds,cases)):
            case_name=pascal(kind)
            require(case_name!=name, 'Union case collides with parent')
            declaration=self.record_text(case_name,case,path+f'/oneOf/{i}',base=name)
            lines.extend('    '+line if line else '' for line in declaration.splitlines())
        lines.append('}')
        self.add(name,'\n'.join(lines))
        return name

    def record(self, name, shape, path):
        definition=path.split('/')[-1] if path.startswith('/$defs/') and path.count('/')==2 else None
        self.add(name,self.record_text(name,shape,path,table=self.table_defs.get(definition)))

    def record_text(self,name,shape,path,table=None,base=None):
        require(shape.get('additionalProperties') is False, f'Open object not supported: {path}')
        properties=shape['properties']
        required=set(shape.get('required',[]))
        unique([pascal(x) for x in properties], f'property C# name in {name}')
        require(name not in [pascal(x) for x in properties], f'Property collides with containing type: {name}')
        lines=['/// <summary>', '/// '+doc(shape.get('description',name+'.')),'/// </summary>']
        remarks=['Schema: #'+path+'.']
        if table:
            domains=[next(d['name'] for d in self.domains if d['id']==m['domain_id']) for m in self.memberships if m['table_id']==table['id']]
            remarks.extend(['Domain(s): '+', '.join(domains)+'.','Table: '+table['id']+'. Row grain: '+table['grain'],
                            'Primary key: '+', '.join(table['primaryKey'])+'.', 'Workflows: '+', '.join(table['workflowIds'])+'.',
                            'Coverage: '+table['coverage']+'. Storage decision: unspecified.',
                            'Semantic rules: '+', '.join(table['invariantIds'])+'.'])
        for condition in ['allOf','anyOf']:
            if condition in shape:
                remarks.append(f'Additional {condition} constraints remain in JSON Schema; constructors do not validate them.')
        lines+=['/// <remarks>']+['/// '+doc(r) for r in remarks]+['/// </remarks>']
        args=[]; constants=[]
        for field,spec in properties.items():
            prop=pascal(field); field_path=path+'/properties/'+field
            note=spec.get('description','Contract field: '+field+'.')
            if field_path in self.overrides:
                target,scope,many=self.overrides[field_path]
                if table and table['snapshotScoped'] and field in table['primaryKey'] and field!='snapshotId' and target==table['id']:
                    note+=' Local key component; the complete key includes SnapshotId.'
                else:
                    note+=' References '+target+' ('+scope+').'
                if scope=='snapshot':
                    note+=' Its snapshot must agree with the containing row/query context.'
            limits={k:spec[k] for k in ['minimum','maximum','minLength','pattern','minItems','maxItems','uniqueItems','format'] if k in spec}
            if limits:
                note+=' Schema constraints: '+json.dumps(limits,ensure_ascii=True,separators=(',',':'))+'.'
            if 'const' in spec:
                value=spec['const']
                require(isinstance(value,(str,int,bool)), 'Unsupported constant')
                cs_type='string' if isinstance(value,str) else 'bool' if isinstance(value,bool) else 'int'
                constants.extend(['    /// <summary>'+doc(note)+'</summary>',f'    public {cs_type} {prop} => '+json.dumps(value)+';'])
                continue
            typ=self.type_of(spec,name+prop,field_path)
            if field not in required and not typ.endswith('?'):
                typ+='?'
                note+=' Optional in JSON; absence is represented by null in this review view.'
            lines.append(f'/// <param name="{prop}">'+doc(note)+'</param>')
            args.append('    '+typ+' '+prop)
        lines.append(f'public sealed record {name}(')
        lines.append(',\n'.join(args))
        lines.append(')'+(' : '+base if base else ''))
        key_lines=[]
        if table:
            require('Key' not in [pascal(x) for x in properties], f'Generated Key property collision: {name}')
            local=pascal(table['primaryKey'][-1])
            if table['snapshotScoped']:
                key_lines=[f'    public SnapshotReferenceKey<{name}> Key => new(SnapshotId, {local}.Value);']
            else:
                key_lines=[f'    public ReferenceKey<{name}> Key => new({local}.Value);']
            key_lines.insert(0,'    /// <summary>Complete relational key for this row; no row lookup is performed.</summary>')
        lines.append('{')
        lines+=constants+key_lines
        lines.append('}')
        return '\n'.join(lines)

    def render(self):
        for name in self.defs:
            self.definition(name)
        require(self.fact_assurance is not None, 'Fact helper requires an assurance vocabulary')
        fingerprint=hashlib.sha256()
        for filename in INPUTS:
            fingerprint.update(filename.encode()+b'\0'+(self.root/filename).read_bytes()+b'\0')
        lines=['// Generated by generate_records.py. DO NOT EDIT THIS FILE.',
               '// Review projection only: not a storage layout, loader, serializer, or validating API.',
               '// Contract version: '+comment(self.catalog['version']), '// Input SHA-256: '+fingerprint.hexdigest(),
               '// Regenerate from the contract directory: python generate_records.py',
               '// JSON constraints, foreign-key existence, target kinds and domain policies still require validation.',
               '// SnapshotReferenceKey carries the full snapshot/local key. Constructors do not enforce row-context agreement.',
               '// ImmutableArray equality is not deep sequence equality. Default structs can contain unset values.',
               '// No generated-code exclusion marker is used: compile checks run the Platonic analyzers on these types.',
               '#nullable enable','using System.Collections.Immutable;','using System.Numerics;','',
               'namespace Ara3D.BimOpenSchema.QueryModel.Review;','',
               '/// <summary>Opaque identity or local-key component, typed by its target table. Does not load a row.</summary>',
               '/// <param name="Value">Original key text; nonempty validity is checked outside these review records.</param>',
               'public readonly record struct ReferenceKey<T>(string Value);','',
               '/// <summary>Complete reference to a row whose identity is scoped to a dataset snapshot.</summary>',
               '/// <param name="SnapshotId">Snapshot containing the target row.</param>',
               '/// <param name="Value">Local key text inside that snapshot.</param>',
               'public readonly record struct SnapshotReferenceKey<T>(ReferenceKey<Snapshot> SnapshotId, string Value);','',
               '/// <summary>Exact base-10 text from the contract. No rounding into System.Decimal or Double is implied.</summary>',
               '/// <param name="Text">Decimal lexical value; the JSON Schema defines its accepted syntax.</param>',
               'public readonly record struct DecimalText(string Text);','',
               '/// <summary>A value with evidence, or an explicit unavailable result. Missing is never an implicit zero.</summary>',
               'public abstract record Fact<T>','{','    private Fact() { }',
               '    /// <summary>An available value with declared assurance and evidence.</summary>',
               f'    public sealed record Available(T Value, {self.fact_assurance} Assurance, Evidence Evidence) : Fact<T>;',
               '    /// <summary>An unavailable value with a reason and evidence; contains no T value.</summary>',
               '    public sealed record Missing(Unavailable Detail) : Fact<T>;','}','']
        table_names=set(self.names.values())
        lines+=['// Shared value types and vocabularies.']
        lines+=[text+'\n' for name,text in self.declarations.items() if name not in table_names]
        for domain in self.domains:
            lines+=['// ============================================================================',
                    '// '+comment(domain['name']), '// '+comment(domain['meaning'])]
            for concept in self.concepts:
                if concept['domain_id']==domain['id']:
                    lines+=['// '+comment(concept['name']+' ['+concept['status']+']: '+concept['meaning']),
                            '//   Tables: '+comment(concept['table_ids'] or '(candidate; no row contract yet)')]
            for table in self.catalog['tables']:
                if any(m['table_id']==table['id'] and m['domain_id']==domain['id'] and m['primary']=='true' for m in self.memberships):
                    lines+=['',self.declarations[self.names[table['id']]],'']
        return '\n'.join(lines).rstrip()+'\n'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='Fail if the checked-in C# view differs; do not write it.')
    parser.add_argument('--output',type=Path,default=ROOT/'generated'/'BimDataModel.cs')
    args=parser.parse_args()
    result=Generator().render()
    if args.check:
        require(args.output.exists() and args.output.read_text(encoding='utf-8')==result, 'Generated C# is stale; run generate_records.py')
        print('Generated C# matches the contract inputs.')
    else:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(result,encoding='utf-8',newline='\n')
        print(f'Generated {args.output}')


if __name__=='__main__':
    main()
