import { useState, useEffect } from "react";

export function useCatalog() {
  const [stars, setStars] = useState([]);
  const [messier, setMessier] = useState([]);
  const [constellationLines, setConstellationLines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => {
        setStars(data.stars ?? []);
        setMessier(data.messier ?? []);
        setConstellationLines(data.constellation_lines ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { stars, messier, constellationLines, loading };
}
