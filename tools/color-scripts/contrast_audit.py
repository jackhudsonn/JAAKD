import re,sys

def hex_to_rgb(h):
    h=h.strip()
    if not h.startswith('#'):
        return None
    h=h[1:]
    if len(h)==3:
        h=''.join([c*2 for c in h])
    if len(h)!=6:
        return None
    r=int(h[0:2],16)/255.0
    g=int(h[2:4],16)/255.0
    b=int(h[4:6],16)/255.0
    return (r,g,b)

def lin(c):
    if c<=0.03928:
        return c/12.92
    return ((c+0.055)/1.055)**2.4

def luminance(rgb):
    r,g,b=rgb
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)

def contrast(hex1, hex2):
    a=hex_to_rgb(hex1)
    b=hex_to_rgb(hex2)
    if a is None or b is None:
        return None
    L1=luminance(a)
    L2=luminance(b)
    Lmax=max(L1,L2)
    Lmin=min(L1,L2)
    return (Lmax+0.05)/(Lmin+0.05)

path='assets/css/style.css'
try:
    txt=open(path,'r',encoding='utf-8').read()
except Exception as e:
    print('ERROR reading',path,e)
    sys.exit(1)

pairs=re.findall(r'--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);', txt)
vars={}
for k,v in pairs:
    v=v.strip()
    m=re.search(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b", v)
    if m:
        vars['--'+k]=m.group(0)

checks=[('--ink','--surface'),('--ink','--bg'),('--accent','--surface'),('--accent','--bg'),('--border','--surface')]
print('Found variables:',','.join(sorted(vars.keys())))
print('\nContrast results (ratio) and AA/AAA checks:')
for fg,bg in checks:
    if fg in vars and bg in vars:
        r=contrast(vars[fg],vars[bg])
        if r is None:
            print(f"{fg} on {bg}: could not compute")
            continue
        aa_normal = 'PASS' if r>=4.5 else 'FAIL'
        aa_large = 'PASS' if r>=3 else 'FAIL'
        aaa = 'PASS' if r>=7 else 'FAIL'
        print(f"{fg} ({vars[fg]}) on {bg} ({vars[bg]}): {r:.2f}: AA(normal)={aa_normal}, AA(large)={aa_large}, AAA={aaa}")
    else:
        print(f"{fg} or {bg} not defined in file, skipping")
