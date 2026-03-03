// Logo lookup utility using manifest.json
let logoManifest: string[] | null = null;

export const getLogoManifest = async (): Promise<string[]> => {
    if (logoManifest) return logoManifest;
    try {
        const response = await fetch('/logos/manifest.json');
        if (logoManifest) return logoManifest; // Handle concurrent calls
        if (response.ok) {
            logoManifest = await response.json();
            return logoManifest || [];
        }
    } catch (err) {
        console.error("Failed to load logo manifest:", err);
    }
    return [];
};

export const findLogoInManifest = (name: string, extensions: string[], manifest: string[]): string | null => {
    // 1. Generate name variations
    const rawName = name.trim();
    if (!rawName) return null;

    const nameSet = new Set<string>();
    nameSet.add(rawName);
    nameSet.add(rawName.replace(/\s+/g, '_'));
    nameSet.add(rawName.replace(/\s+/g, '_').replace(/[()㈜]/g, ''));

    const alternate = rawName.includes('㈜') ? rawName.replace('㈜', '(주)') :
        rawName.includes('(주)') ? rawName.replace('(주)', '㈜') : null;
    if (alternate) nameSet.add(alternate);

    const names = Array.from(nameSet);

    // 2. Check manifest for matches (Local lookup - NO NETWORK)
    for (const n of names) {
        for (const ext of extensions) {
            const fileName = `${n}.${ext}`;
            if (manifest.includes(fileName)) {
                return `/logos/${fileName}`;
            }
        }
    }
    return null;
};
