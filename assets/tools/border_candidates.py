from math import isclose

def hex_to_rgb(h):
    h=h.strip()[1:]
    if len(h)==3:
        h=''.join(c*2 for c in h)
    return tuple(int(h[i:i+2],16)/255.0 for i in (0,2,4))

def lin(c):
    return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4

def lum(h):
    r,g,b=hex_to_rgb(h)
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)

def contrast(a,b):
    L1=lum(a)
    L2=lum(b)
    Lmax=max(L1,L2); Lmin=min(L1,L2)
    return (Lmax+0.05)/(Lmin+0.05)

surface='#fffdfa'
candidates=['#cfc6b5','#c2b9a8','#b5ac9b','#a89878','#9a8f80','#8f867a']
print('surface',surface)
for c in candidates:
    print(c, contrast(c,surface))
