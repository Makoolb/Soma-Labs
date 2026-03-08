export interface Topic {
  name: string;
  icon: string;
}

export const MATHS_TOPICS: Topic[] = [
  { name: "Number & Numeration", icon: "numeric" },
  { name: "Basic Operations", icon: "plus-minus-variant" },
  { name: "Fractions & Decimals", icon: "fraction-one-half" },
  { name: "Percentages", icon: "percent" },
  { name: "Length & Measurement", icon: "ruler" },
  { name: "Time & Calendar", icon: "clock-outline" },
  { name: "Money & Shopping", icon: "currency-ngn" },
  { name: "Geometry & Shapes", icon: "shape-outline" },
  { name: "Perimeter & Area", icon: "vector-square" },
  { name: "Word Problems", icon: "text-box-outline" },
  { name: "Data & Charts", icon: "chart-bar" },
  { name: "Multiplication Tables", icon: "table" },
];

export const ENGLISH_TOPICS: Topic[] = [
  { name: "Comprehension", icon: "book-open-page-variant" },
  { name: "Vocabulary & Spelling", icon: "alphabetical" },
  { name: "Grammar & Tenses", icon: "format-text" },
  { name: "Punctuation & Capitals", icon: "format-letter-case" },
  { name: "Parts of Speech", icon: "tag-text-outline" },
  { name: "Synonyms & Antonyms", icon: "arrow-left-right" },
  { name: "Sentence Construction", icon: "format-align-left" },
  { name: "Comprehension Passages", icon: "text-box-multiple-outline" },
  { name: "Idioms & Proverbs", icon: "chat-processing-outline" },
  { name: "Letter Writing", icon: "email-outline" },
];
