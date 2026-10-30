import json, subprocess, sys, urllib.request, os

OUT = sys.argv[1]
WANT = int(sys.argv[2])
have = set(json.load(open(f'{OUT}/manifest.json')))

def get(url):
    return json.load(urllib.request.urlopen(url, timeout=30))

def stats(src, ss):
    r = subprocess.run(['ffmpeg', '-nostdin', '-ss', str(ss), '-i', src, '-frames:v', '1',
                        '-vf', 'signalstats,metadata=print', '-f', 'null', '-'],
                       capture_output=True, text=True, timeout=60).stderr
    val = lambda k: float(r.split(f'lavfi.signalstats.{k}=')[1].split()[0])
    return val('SATAVG'), val('YAVG')

q = ('https://archive.org/advancedsearch.php?q=collection%3Aprelinger+AND+mediatype%3Amovies'
     '+AND+licenseurl%3A%2Apublicdomain%2A&fl%5B%5D=identifier&fl%5B%5D=title'
     '&sort%5B%5D=downloads+desc&rows=200&output=json')
docs = get(q)['response']['docs']
added = []
for d in docs:
    if len(added) >= WANT:
        break
    id = d['identifier']
    if f'{id}.mp4' in have:
        continue
    try:
        files = get(f'https://archive.org/metadata/{id}/files')['result']
        mp4 = next(f for f in files if f['name'] in (f'{id}.mp4', f'{id}.ia.mp4'))
        length = float(mp4['length'])
        if length < 90:
            continue
        src = f"https://archive.org/download/{id}/{mp4['name']}"
        ss = round(length * 0.4)
        samples = [stats(src, ss), stats(src, ss + 15)]
        if any(s > 6 for s, _ in samples) or any(y < 35 for _, y in samples):
            print('skip', id, samples, flush=True)
            continue
        subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-ss', str(ss), '-i', src, '-t', '20',
                        '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
                        '-movflags', '+faststart', f'{OUT}/{id}.mp4'], check=True, timeout=300)
        added.append(f'{id}.mp4')
        print('ok', id, d.get('title'), flush=True)
    except Exception as e:
        print('error', id, e, flush=True)

json.dump(sorted(have) + added, open(f'{OUT}/manifest.json', 'w'), indent=0)
print('total', len(have) + len(added))
