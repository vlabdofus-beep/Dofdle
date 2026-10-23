import struct
COMMON = ("AABB\0AnimationClip\0AnimationCurve\0AnimationState\0Array\0Base\0BitField\0bitset\0bool\0char\0ColorRGBA\0Component\0data\0deque\0double\0dynamic_array\0FastPropertyName\0first\0float\0Font\0GameObject\0Generic Mono\0GradientNEW\0GUID\0GUIStyle\0int\0list\0long long\0map\0Matrix4x4f\0MdFour\0MonoBehaviour\0MonoScript\0m_ByteSize\0m_Curve\0m_EditorClassIdentifier\0m_EditorHideFlags\0m_Enabled\0m_ExtensionPtr\0m_GameObject\0m_Index\0m_IsArray\0m_IsStatic\0m_MetaFlag\0m_Name\0m_ObjectHideFlags\0m_PrefabInternal\0m_PrefabParentObject\0m_Script\0m_StaticEditorFlags\0m_Type\0m_Version\0Object\0pair\0PPtr<Component>\0PPtr<GameObject>\0PPtr<Material>\0PPtr<MonoBehaviour>\0PPtr<MonoScript>\0PPtr<Object>\0PPtr<Prefab>\0PPtr<Sprite>\0PPtr<TextAsset>\0PPtr<Texture>\0PPtr<Texture2D>\0PPtr<Transform>\0Prefab\0Quaternionf\0Rectf\0RectInt\0RectOffset\0second\0set\0short\0size\0SInt16\0SInt32\0SInt64\0SInt8\0staticvector\0string\0TextAsset\0TextMesh\0Texture\0Texture2D\0Transform\0TypelessData\0UInt16\0UInt32\0UInt64\0UInt8\0unsigned int\0unsigned long long\0unsigned short\0vector\0Vector2f\0Vector3f\0Vector4f\0m_ScriptingClassIdentifier\0Gradient\0Type*\0int2_storage\0int3_storage\0BoundsInt\0m_CorrespondingSourceObject\0m_PrefabInstance\0m_PrefabAsset\0FileSize\0Hash128\0RenderingLayerMask\0")
CS = {}
o = 0
for s in COMMON.split('\0'):
    CS[o] = s; o += len(s) + 1

class R:
    def __init__(s, b, le=True): s.b=b; s.i=0; s.e='<' if le else '>'
    def u(s, fmt):
        v = struct.unpack_from(s.e+fmt, s.b, s.i); s.i += struct.calcsize(fmt); return v[0]
    def cstr(s):
        j = s.b.index(b'\0', s.i); v = s.b[s.i:j].decode('utf8','replace'); s.i = j+1; return v
    def align(s): s.i = (s.i + 3) & ~3
    def raw(s, n): v = s.b[s.i:s.i+n]; s.i += n; return v

def parse(b):
    r = R(b, False)
    r.u('I'); r.u('I'); ver = r.u('I'); r.u('I')
    assert ver >= 22, ver
    endian = r.u('B'); r.raw(3)
    r.u('I'); r.u('q'); dataOffset = r.u('q'); r.u('q')
    r.e = '>' if endian else '<'
    uv = r.cstr(); r.u('i'); tt = r.u('?')
    types = []
    for _ in range(r.u('i')):
        cid = r.u('i'); r.u('?'); sti = r.u('h')
        if cid == 114: r.raw(16)
        r.raw(16)
        nodes = None
        if tt:
            nn = r.u('i'); sb = r.u('i')
            raw = [(r.u('H'), r.u('B'), r.u('B'), r.u('I'), r.u('I'), r.u('i'), r.u('i'), r.u('i'), r.u('Q')) for _ in range(nn)]
            strs = r.raw(sb)
            def gs(off):
                if off & 0x80000000: return CS.get(off & 0x7fffffff, '?')
                j = strs.index(b'\0', off); return strs[off:j].decode()
            nodes = [dict(level=x[1], type=gs(x[3]), name=gs(x[4]), size=x[5], meta=x[7]) for x in raw]
            for _ in range(r.u('i')): r.u('i')
        types.append((cid, nodes))
    n = r.u('i'); objs = []
    for _ in range(n):
        r.align(); pid = r.u('q'); start = r.u('q'); size = r.u('I'); tid = r.u('i')
        objs.append(dict(pid=pid, start=dataOffset+start, size=size, cid=types[tid][0], nodes=types[tid][1]))
    return uv, objs, r.e

def children(nodes, i):
    lv = nodes[i]['level']; out = []; j = i + 1
    while j < len(nodes) and nodes[j]['level'] > lv:
        if nodes[j]['level'] == lv + 1: out.append(j)
        j += 1
    return out

PRIM = {'SInt8':'b','UInt8':'B','char':'b','short':'h','SInt16':'h','UInt16':'H','unsigned short':'H','int':'i','SInt32':'i','UInt32':'I','unsigned int':'I','Type*':'i','long long':'q','SInt64':'q','UInt64':'Q','unsigned long long':'Q','FileSize':'Q','float':'f','double':'d','bool':'?'}

def read_node(r, nodes, i):
    n = nodes[i]; t = n['type']; ch = children(nodes, i)
    if t in PRIM and not ch:
        v = r.u(PRIM[t])
    elif t == 'string':
        ln = r.u('i'); v = r.raw(ln).decode('utf8','replace'); r.align()
    elif t == 'TypelessData':
        ln = r.u('i'); v = r.raw(ln)
    elif ch and nodes[ch[0]]['type'] == 'Array':
        arr = ch[0]; ac = children(nodes, arr)
        ln = r.u('i'); el = ac[1]
        et = nodes[el]['type']
        if et in ('UInt8','char','SInt8') and not children(nodes, el):
            v = r.raw(ln)
        else:
            v = [read_node(r, nodes, el) for _ in range(ln)]
        if nodes[arr]['meta'] & 0x4000: r.align()
    else:
        v = {nodes[c]['name']: read_node(r, nodes, c) for c in ch}
    if n['meta'] & 0x4000: r.align()
    return v

def read_obj(b, o, e):
    r = R(b); r.e = e; r.i = o['start']
    return read_node(r, o['nodes'], 0)
