export function createSpawner(minOffset) {
  const centers = [];
  return {
    centers,
    tryAdd(c) {
      const clash = centers.find(p => Math.abs(c.x - p.x) < minOffset && Math.abs(c.y - p.y) < minOffset);
      if (!clash) centers.push(c);
      return { ok: !clash, clash };
    },
  };
}
