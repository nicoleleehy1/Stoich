type PubChemProperty = {
  CID?: number;
  MolecularFormula?: string;
  MolecularWeight?: string | number;
  IUPACName?: string;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const smiles = url.searchParams.get("smiles");
    if (!smiles) {
      return Response.json(
        { formula: null, weight: null, iupac_from_pubchem: null, cid: null },
        { status: 200 }
      );
    }

    const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(
      smiles
    )}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`;

    const res = await fetch(pubchemUrl);
    if (!res.ok) {
      return Response.json({
        formula: null,
        weight: null,
        iupac_from_pubchem: null,
        cid: null,
      });
    }

    const data = (await res.json()) as {
      PropertyTable?: { Properties?: PubChemProperty[] };
    };
    const props = data.PropertyTable?.Properties?.[0];
    if (!props) {
      return Response.json({
        formula: null,
        weight: null,
        iupac_from_pubchem: null,
        cid: null,
      });
    }

    return Response.json({
      formula: props.MolecularFormula ?? null,
      weight:
        props.MolecularWeight !== undefined
          ? String(props.MolecularWeight)
          : null,
      iupac_from_pubchem: props.IUPACName ?? null,
      cid: props.CID ?? null,
    });
  } catch (e) {
    console.error("compound-info failed", e);
    return Response.json({
      formula: null,
      weight: null,
      iupac_from_pubchem: null,
      cid: null,
    });
  }
}
