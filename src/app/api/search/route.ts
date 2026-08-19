import { NextResponse } from "next/server";

type SearchResult = {
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  Heading?: string;
};

export async function POST(request: Request) {
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid search request." }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) return NextResponse.json({ error: "Enter a search question." }, { status: 400 });

  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    const result = await response.json() as SearchResult;
    if (!response.ok || !result.AbstractText) {
      return NextResponse.json({ error: "No concise web result was found for that question." }, { status: 404 });
    }

    const source = result.AbstractSource ? ` Source: ${result.AbstractSource}.` : "";
    return NextResponse.json({ answer: `${result.AbstractText}${source}`, sourceUrl: result.AbstractURL, heading: result.Heading });
  } catch {
    return NextResponse.json({ error: "The web knowledge service is unavailable." }, { status: 503 });
  }
}
