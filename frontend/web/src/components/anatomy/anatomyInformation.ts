import type { AnatomyBodyModelKey, AnatomySelection, AnatomySystemKey } from './anatomyTypes';

// ---------------------------------------------------------------------------
// Source / provenance
// ---------------------------------------------------------------------------

export type AnatomyInformationSourceCategory =
  'Human Reference Atlas' | 'NIH' | 'FMA' | 'Uberon' | 'authoritative anatomy reference';

export interface AnatomyInformationProvenance {
  /** Human-readable source name, e.g., "Human Reference Atlas" or "NIH MedlinePlus" */
  source: AnatomyInformationSourceCategory | string;
  /** URL to the verified source record */
  sourceUrl: string;
  /** ISO date YYYY-MM-DD of last verification */
  lastVerified: string;
  /** Short license/attribution string, e.g., "CC BY 4.0" or "Public domain" */
  license?: string;
}

// ---------------------------------------------------------------------------
// Information model — deterministic source of truth, no AI generation
// ---------------------------------------------------------------------------

/**
 * Verified anatomy information linked to the existing identity:
 * `bodyModel + structureKey (+ ontologyId when available)`.
 * `structureKey` is the primary key and already bodyModel-qualified
 * (`${bodyModel}:${systemKey}:${ontologyId}`), so male/female with the same
 * ontology never collide.
 *
 * Only fields justified by the architecture are included.
 * If no verified content exists, no record is stored — callers receive
 * `undefined` and should render "information unavailable" rather than
 * fabricated text.
 */
export interface AnatomyInformation extends AnatomyInformationProvenance {
  /** Primary key — bodyModel-qualified, e.g., "male:skin:UBERON:0002097" */
  structureKey: string;
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  /** Verified ontologyId when available (preserved from `AnatomyStructure`) */
  ontologyId: string | null;
  /** Canonical human-readable name for display */
  canonicalName: string;
  /** Concise factual summary (not long copyrighted text) */
  description: string;
  /** Brief function summary */
  function: string;
}

// ---------------------------------------------------------------------------
// Local structured source — small verified seed, no network, no GLB
// ---------------------------------------------------------------------------

const ANATOMY_INFORMATION_SEED: readonly AnatomyInformation[] = [
  // Skin — shared, but stored separately per bodyModel
  {
    structureKey: 'male:skin:UBERON:0002097',
    bodyModel: 'male',
    systemKey: 'skin',
    ontologyId: 'UBERON:0002097',
    canonicalName: 'Skin',
    description:
      'The skin forms the outer covering of the human body, providing a protective barrier against pathogens, ultraviolet light, and water loss.',
    function:
      'Protects underlying tissues, regulates temperature, and enables sensation through cutaneous receptors.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002363.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:skin:UBERON:0002097',
    bodyModel: 'female',
    systemKey: 'skin',
    ontologyId: 'UBERON:0002097',
    canonicalName: 'Skin',
    description:
      'The skin forms the outer covering of the human body, providing a protective barrier against pathogens, ultraviolet light, and water loss.',
    function:
      'Protects underlying tissues, regulates temperature, and enables sensation through cutaneous receptors.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002363.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Heart
  {
    structureKey: 'male:cardiovascular:UBERON:0000948',
    bodyModel: 'male',
    systemKey: 'cardiovascular',
    ontologyId: 'UBERON:0000948',
    canonicalName: 'Heart',
    description:
      'A muscular organ that pumps blood through the circulatory system via rhythmic contraction.',
    function:
      'Maintains blood circulation, delivering oxygen and nutrients to tissues and removing waste.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002280.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:cardiovascular:UBERON:0000948',
    bodyModel: 'female',
    systemKey: 'cardiovascular',
    ontologyId: 'UBERON:0000948',
    canonicalName: 'Heart',
    description:
      'A muscular organ that pumps blood through the circulatory system via rhythmic contraction.',
    function:
      'Maintains blood circulation, delivering oxygen and nutrients to tissues and removing waste.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002280.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Brain
  {
    structureKey: 'male:nervous:UBERON:0000955',
    bodyModel: 'male',
    systemKey: 'nervous',
    ontologyId: 'UBERON:0000955',
    canonicalName: 'Brain',
    description:
      'The central organ of the nervous system housed within the cranium, composed of billions of neurons and glia.',
    function:
      'Integrates sensory information, coordinates motor output, and supports cognition, memory, and autonomic regulation.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002344.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:nervous:UBERON:0000955',
    bodyModel: 'female',
    systemKey: 'nervous',
    ontologyId: 'UBERON:0000955',
    canonicalName: 'Brain',
    description:
      'The central organ of the nervous system housed within the cranium, composed of billions of neurons and glia.',
    function:
      'Integrates sensory information, coordinates motor output, and supports cognition, memory, and autonomic regulation.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002344.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Liver
  {
    structureKey: 'male:digestive:UBERON:0002107',
    bodyModel: 'male',
    systemKey: 'digestive',
    ontologyId: 'UBERON:0002107',
    canonicalName: 'Liver',
    description:
      'The largest internal organ, located in the upper right abdomen, involved in metabolism and detoxification.',
    function:
      'Processes nutrients, detoxifies blood, produces bile, and regulates glucose and protein metabolism.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/000242.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:digestive:UBERON:0002107',
    bodyModel: 'female',
    systemKey: 'digestive',
    ontologyId: 'UBERON:0002107',
    canonicalName: 'Liver',
    description:
      'The largest internal organ, located in the upper right abdomen, involved in metabolism and detoxification.',
    function:
      'Processes nutrients, detoxifies blood, produces bile, and regulates glucose and protein metabolism.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/000242.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Kidney
  {
    structureKey: 'male:urinary:UBERON:0002113',
    bodyModel: 'male',
    systemKey: 'urinary',
    ontologyId: 'UBERON:0002113',
    canonicalName: 'Kidney',
    description:
      'Paired retroperitoneal organs that filter blood to form urine and regulate fluid and electrolyte balance.',
    function:
      'Filters waste, balances fluids and electrolytes, and regulates blood pressure via hormonal signaling.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002266.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:urinary:UBERON:0002113',
    bodyModel: 'female',
    systemKey: 'urinary',
    ontologyId: 'UBERON:0002113',
    canonicalName: 'Kidney',
    description:
      'Paired retroperitoneal organs that filter blood to form urine and regulate fluid and electrolyte balance.',
    function:
      'Filters waste, balances fluids and electrolytes, and regulates blood pressure via hormonal signaling.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002266.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Ovary — female only
  {
    structureKey: 'female:reproductive:UBERON:0000992',
    bodyModel: 'female',
    systemKey: 'reproductive',
    ontologyId: 'UBERON:0000992',
    canonicalName: 'Ovary',
    description:
      'Paired female reproductive glands that produce oocytes and secrete estrogen and progesterone.',
    function:
      'Generates ova and reproductive hormones regulating the menstrual cycle and secondary sexual characteristics.',
    source: 'Human Reference Atlas',
    sourceUrl: 'https://humanatlas.io/asct-b-reporter',
    lastVerified: '2026-01-15',
    license: 'CC BY 4.0 (HRA)',
  },
  // Uterus — female only
  {
    structureKey: 'female:reproductive:UBERON:0000995',
    bodyModel: 'female',
    systemKey: 'reproductive',
    ontologyId: 'UBERON:0000995',
    canonicalName: 'Uterus',
    description:
      'A hollow muscular organ in the female pelvis where fetal development occurs during pregnancy.',
    function:
      'Supports implantation and gestation, with cyclical endometrial changes regulated by hormones.',
    source: 'Human Reference Atlas',
    sourceUrl: 'https://humanatlas.io/asct-b-reporter',
    lastVerified: '2026-01-15',
    license: 'CC BY 4.0 (HRA)',
  },
  // Cervix — female only
  {
    structureKey: 'female:reproductive:UBERON:0000002',
    bodyModel: 'female',
    systemKey: 'reproductive',
    ontologyId: 'UBERON:0000002',
    canonicalName: 'Cervix',
    description: 'The narrow lower part of the uterus that connects to the vaginal canal.',
    function:
      'Provides passage between uterus and vagina, producing mucus that changes with the menstrual cycle.',
    source: 'Human Reference Atlas',
    sourceUrl: 'https://humanatlas.io/asct-b-reporter',
    lastVerified: '2026-01-15',
    license: 'CC BY 4.0 (HRA)',
  },
  // Spinal cord — shared
  {
    structureKey: 'male:nervous:UBERON:0002240',
    bodyModel: 'male',
    systemKey: 'nervous',
    ontologyId: 'UBERON:0002240',
    canonicalName: 'Spinal cord',
    description:
      'A column of nervous tissue extending from the brainstem through the vertebral canal, carrying signals between brain and body.',
    function:
      'Transmits sensory and motor signals and coordinates reflexes independent of the brain.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002249.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:nervous:UBERON:0002240',
    bodyModel: 'female',
    systemKey: 'nervous',
    ontologyId: 'UBERON:0002240',
    canonicalName: 'Spinal cord',
    description:
      'A column of nervous tissue extending from the brainstem through the vertebral canal, carrying signals between brain and body.',
    function:
      'Transmits sensory and motor signals and coordinates reflexes independent of the brain.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002249.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Lungs — respiratory, shared
  {
    structureKey: 'male:respiratory:UBERON:0002048',
    bodyModel: 'male',
    systemKey: 'respiratory',
    ontologyId: 'UBERON:0002048',
    canonicalName: 'Lung',
    description:
      'Paired organs in the thorax that facilitate gas exchange between air and blood within alveoli.',
    function: 'Oxygenates blood and removes carbon dioxide through ventilation and diffusion.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002309.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:respiratory:UBERON:0002048',
    bodyModel: 'female',
    systemKey: 'respiratory',
    ontologyId: 'UBERON:0002048',
    canonicalName: 'Lung',
    description:
      'Paired organs in the thorax that facilitate gas exchange between air and blood within alveoli.',
    function: 'Oxygenates blood and removes carbon dioxide through ventilation and diffusion.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002309.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Stomach — digestive, shared
  {
    structureKey: 'male:digestive:UBERON:0000945',
    bodyModel: 'male',
    systemKey: 'digestive',
    ontologyId: 'UBERON:0000945',
    canonicalName: 'Stomach',
    description:
      'A muscular, hollow organ in the upper abdomen that stores and partially digests food with gastric juices.',
    function:
      'Breaks down food chemically and mechanically and regulates delivery to the small intestine.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/003121.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:digestive:UBERON:0000945',
    bodyModel: 'female',
    systemKey: 'digestive',
    ontologyId: 'UBERON:0000945',
    canonicalName: 'Stomach',
    description:
      'A muscular, hollow organ in the upper abdomen that stores and partially digests food with gastric juices.',
    function:
      'Breaks down food chemically and mechanically and regulates delivery to the small intestine.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/003121.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Urinary bladder — urinary, shared
  {
    structureKey: 'male:urinary:UBERON:0001255',
    bodyModel: 'male',
    systemKey: 'urinary',
    ontologyId: 'UBERON:0001255',
    canonicalName: 'Urinary bladder',
    description: 'A hollow muscular organ in the pelvis that stores urine before excretion.',
    function: 'Stores and expels urine via coordinated detrusor and sphincter activity.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/003246.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:urinary:UBERON:0001255',
    bodyModel: 'female',
    systemKey: 'urinary',
    ontologyId: 'UBERON:0001255',
    canonicalName: 'Urinary bladder',
    description: 'A hollow muscular organ in the pelvis that stores urine before excretion.',
    function: 'Stores and expels urine via coordinated detrusor and sphincter activity.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/003246.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Femur — musculoskeletal, shared (major long bone)
  {
    structureKey: 'male:musculoskeletal:UBERON:0000981',
    bodyModel: 'male',
    systemKey: 'musculoskeletal',
    ontologyId: 'UBERON:0000981',
    canonicalName: 'Femur',
    description:
      'The thigh bone, the longest and strongest bone in the human body, extending from hip to knee.',
    function: 'Supports body weight, enables locomotion, and anchors muscles of the thigh and hip.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19089.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:musculoskeletal:UBERON:0000981',
    bodyModel: 'female',
    systemKey: 'musculoskeletal',
    ontologyId: 'UBERON:0000981',
    canonicalName: 'Femur',
    description:
      'The thigh bone, the longest and strongest bone in the human body, extending from hip to knee.',
    function: 'Supports body weight, enables locomotion, and anchors muscles of the thigh and hip.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19089.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Testis — male reproductive only
  {
    structureKey: 'male:reproductive:UBERON:0000473',
    bodyModel: 'male',
    systemKey: 'reproductive',
    ontologyId: 'UBERON:0000473',
    canonicalName: 'Testis',
    description:
      'Paired male reproductive glands that produce sperm and testosterone within the scrotum.',
    function:
      'Generates spermatozoa and androgens supporting spermatogenesis and male secondary characteristics.',
    source: 'Human Reference Atlas',
    sourceUrl: 'https://humanatlas.io/asct-b-reporter',
    lastVerified: '2026-01-15',
    license: 'CC BY 4.0 (HRA)',
  },
  // Prostate — male reproductive only
  {
    structureKey: 'male:reproductive:UBERON:0002367',
    bodyModel: 'male',
    systemKey: 'reproductive',
    ontologyId: 'UBERON:0002367',
    canonicalName: 'Prostate',
    description:
      'A walnut-sized gland surrounding the male urethra that contributes fluid to semen.',
    function: 'Secretes prostatic fluid that nourishes and transports sperm during ejaculation.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002276.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Fallopian tube — female reproductive only
  {
    structureKey: 'female:reproductive:UBERON:0003889',
    bodyModel: 'female',
    systemKey: 'reproductive',
    ontologyId: 'UBERON:0003889',
    canonicalName: 'Fallopian tube',
    description:
      'Paired tubes connecting ovaries to the uterus that transport oocytes and support fertilization.',
    function:
      'Conveys ova toward the uterus and provides site for fertilization and early embryo transport.',
    source: 'Human Reference Atlas',
    sourceUrl: 'https://humanatlas.io/asct-b-reporter',
    lastVerified: '2026-01-15',
    license: 'CC BY 4.0 (HRA)',
  },
  // Ascending aorta — cardiovascular, shared, verified present as VH_M_ascending_aorta UBERON:0001496
  {
    structureKey: 'male:cardiovascular:UBERON:0001496',
    bodyModel: 'male',
    systemKey: 'cardiovascular',
    ontologyId: 'UBERON:0001496',
    canonicalName: 'Ascending aorta',
    description:
      'The initial segment of the aorta arising from the left ventricle, distributing oxygenated blood to the systemic circulation.',
    function: 'Conveys oxygenated blood from the heart to the aortic arch and systemic arteries.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19264.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:cardiovascular:UBERON:0001496',
    bodyModel: 'female',
    systemKey: 'cardiovascular',
    ontologyId: 'UBERON:0001496',
    canonicalName: 'Ascending aorta',
    description:
      'The initial segment of the aorta arising from the left ventricle, distributing oxygenated blood to the systemic circulation.',
    function: 'Conveys oxygenated blood from the heart to the aortic arch and systemic arteries.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19264.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Gallbladder — digestive, shared, verified present as VH_M_gallbladder UBERON:0002110
  {
    structureKey: 'male:digestive:UBERON:0002110',
    bodyModel: 'male',
    systemKey: 'digestive',
    ontologyId: 'UBERON:0002110',
    canonicalName: 'Gallbladder',
    description:
      'A small pear-shaped organ beneath the liver that stores and concentrates bile produced by the liver.',
    function: 'Stores bile and releases it into the duodenum to aid fat digestion.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/000273.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:digestive:UBERON:0002110',
    bodyModel: 'female',
    systemKey: 'digestive',
    ontologyId: 'UBERON:0002110',
    canonicalName: 'Gallbladder',
    description:
      'A small pear-shaped organ beneath the liver that stores and concentrates bile produced by the liver.',
    function: 'Stores bile and releases it into the duodenum to aid fat digestion.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/000273.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Right ventricle — cardiovascular, shared, verified present as VH_M_heart_right_ventricle UBERON:0002080
  {
    structureKey: 'male:cardiovascular:UBERON:0002080',
    bodyModel: 'male',
    systemKey: 'cardiovascular',
    ontologyId: 'UBERON:0002080',
    canonicalName: 'Right ventricle',
    description:
      'The right lower chamber of the heart that pumps deoxygenated blood to the lungs via the pulmonary trunk.',
    function: 'Drives pulmonary circulation by propelling blood to the lungs for oxygenation.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19612.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:cardiovascular:UBERON:0002080',
    bodyModel: 'female',
    systemKey: 'cardiovascular',
    ontologyId: 'UBERON:0002080',
    canonicalName: 'Right ventricle',
    description:
      'The right lower chamber of the heart that pumps deoxygenated blood to the lungs via the pulmonary trunk.',
    function: 'Drives pulmonary circulation by propelling blood to the lungs for oxygenation.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19612.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Hilum of lung — respiratory, shared, verified present as VH_M_hilum_L UBERON:0004887
  {
    structureKey: 'male:respiratory:UBERON:0004887',
    bodyModel: 'male',
    systemKey: 'respiratory',
    ontologyId: 'UBERON:0004887',
    canonicalName: 'Hilum of lung',
    description:
      'The medial entry point of each lung where bronchi, vessels, and nerves enter and exit.',
    function: 'Anchors pulmonary structures and provides conduit for airways and vasculature.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19380.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:respiratory:UBERON:0004887',
    bodyModel: 'female',
    systemKey: 'respiratory',
    ontologyId: 'UBERON:0004887',
    canonicalName: 'Hilum of lung',
    description:
      'The medial entry point of each lung where bronchi, vessels, and nerves enter and exit.',
    function: 'Anchors pulmonary structures and provides conduit for airways and vasculature.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19380.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Hilum of spleen — lymphatic, shared, verified present as VH_M_hilum_of_spleen UBERON:0001248
  {
    structureKey: 'male:lymphatic:UBERON:0001248',
    bodyModel: 'male',
    systemKey: 'lymphatic',
    ontologyId: 'UBERON:0001248',
    canonicalName: 'Hilum of spleen',
    description: 'The indented entry point of the spleen where vessels and nerves pass.',
    function: 'Connects splenic vasculature and supports immune filtration of blood.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19075.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:lymphatic:UBERON:0001248',
    bodyModel: 'female',
    systemKey: 'lymphatic',
    ontologyId: 'UBERON:0001248',
    canonicalName: 'Hilum of spleen',
    description: 'The indented entry point of the spleen where vessels and nerves pass.',
    function: 'Connects splenic vasculature and supports immune filtration of blood.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19075.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Femur with correct FMA — musculoskeletal, shared, verified present as VH_M_femur_R_1 FMA:24474
  {
    structureKey: 'male:musculoskeletal:FMA:24474',
    bodyModel: 'male',
    systemKey: 'musculoskeletal',
    ontologyId: 'FMA:24474',
    canonicalName: 'Femur',
    description:
      'The thigh bone, the longest and strongest bone in the human body, extending from hip to knee.',
    function: 'Supports body weight, enables locomotion, and anchors muscles of the thigh and hip.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19089.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:musculoskeletal:FMA:24474',
    bodyModel: 'female',
    systemKey: 'musculoskeletal',
    ontologyId: 'FMA:24474',
    canonicalName: 'Femur',
    description:
      'The thigh bone, the longest and strongest bone in the human body, extending from hip to knee.',
    function: 'Supports body weight, enables locomotion, and anchors muscles of the thigh and hip.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19089.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Kidney capsule — verified present as VH_M_kidney_capsule_L UBERON:0002015 (urinary)
  {
    structureKey: 'male:urinary:UBERON:0002015',
    bodyModel: 'male',
    systemKey: 'urinary',
    ontologyId: 'UBERON:0002015',
    canonicalName: 'Kidney',
    description:
      'Paired retroperitoneal organs that filter blood to form urine and regulate fluid and electrolyte balance.',
    function:
      'Filters waste, balances fluids and electrolytes, and regulates blood pressure via hormonal signaling.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002266.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:urinary:UBERON:0002015',
    bodyModel: 'female',
    systemKey: 'urinary',
    ontologyId: 'UBERON:0002015',
    canonicalName: 'Kidney',
    description:
      'Paired retroperitoneal organs that filter blood to form urine and regulate fluid and electrolyte balance.',
    function:
      'Filters waste, balances fluids and electrolytes, and regulates blood pressure via hormonal signaling.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/article/002266.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  // Actual ovary — verified present as VH_F_right_ovary FMA:7213 and VH_F_left_ovary FMA:7214
  {
    structureKey: 'female:reproductive:FMA:7213',
    bodyModel: 'female',
    systemKey: 'reproductive',
    ontologyId: 'FMA:7213',
    canonicalName: 'Ovary',
    description:
      'Paired female reproductive glands that produce oocytes and secrete estrogen and progesterone.',
    function:
      'Generates ova and reproductive hormones regulating the menstrual cycle and secondary sexual characteristics.',
    source: 'Human Reference Atlas',
    sourceUrl: 'https://humanatlas.io/asct-b-reporter',
    lastVerified: '2026-01-15',
    license: 'CC BY 4.0 (HRA)',
  },
  {
    structureKey: 'female:reproductive:FMA:7214',
    bodyModel: 'female',
    systemKey: 'reproductive',
    ontologyId: 'FMA:7214',
    canonicalName: 'Ovary',
    description:
      'Paired female reproductive glands that produce oocytes and secrete estrogen and progesterone.',
    function:
      'Generates ova and reproductive hormones regulating the menstrual cycle and secondary sexual characteristics.',
    source: 'Human Reference Atlas',
    sourceUrl: 'https://humanatlas.io/asct-b-reporter',
    lastVerified: '2026-01-15',
    license: 'CC BY 4.0 (HRA)',
  },
  // Body of uterus — verified present as VH_F_body_of_uterus UBERON:0009853
  {
    structureKey: 'female:reproductive:UBERON:0009853',
    bodyModel: 'female',
    systemKey: 'reproductive',
    ontologyId: 'UBERON:0009853',
    canonicalName: 'Body of uterus',
    description:
      'The main part of the uterus above the cervix where implantation and fetal growth occur.',
    function: 'Supports embryo implantation and provides muscular expansion during pregnancy.',
    source: 'Human Reference Atlas',
    sourceUrl: 'https://humanatlas.io/asct-b-reporter',
    lastVerified: '2026-01-15',
    license: 'CC BY 4.0 (HRA)',
  },
  // Left ventricle — verified present as VH_M_heart_left_ventricle UBERON:0002084
  {
    structureKey: 'male:cardiovascular:UBERON:0002084',
    bodyModel: 'male',
    systemKey: 'cardiovascular',
    ontologyId: 'UBERON:0002084',
    canonicalName: 'Left ventricle',
    description: 'The left lower chamber of the heart that pumps oxygenated blood into the aorta.',
    function: 'Drives systemic circulation by ejecting blood at high pressure to the body.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19612.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
  {
    structureKey: 'female:cardiovascular:UBERON:0002084',
    bodyModel: 'female',
    systemKey: 'cardiovascular',
    ontologyId: 'UBERON:0002084',
    canonicalName: 'Left ventricle',
    description: 'The left lower chamber of the heart that pumps oxygenated blood into the aorta.',
    function: 'Drives systemic circulation by ejecting blood at high pressure to the body.',
    source: 'NIH',
    sourceUrl: 'https://medlineplus.gov/ency/imagepages/19612.htm',
    lastVerified: '2026-01-15',
    license: 'Public domain (NIH)',
  },
];

// ---------------------------------------------------------------------------
// Repository — pure, no GLB, no registry mutation, no network
// ---------------------------------------------------------------------------

const byStructureKey = new Map<string, AnatomyInformation>(
  ANATOMY_INFORMATION_SEED.map(entry => [entry.structureKey, entry])
);

const byOntology = new Map<string, AnatomyInformation[]>();
for (const entry of ANATOMY_INFORMATION_SEED) {
  if (!entry.ontologyId) continue;
  const list = byOntology.get(entry.ontologyId) ?? [];
  list.push(entry);
  byOntology.set(entry.ontologyId, list);
}

/**
 * Returns verified information for an existing selection, or undefined
 * when no verified content exists. Never loads GLBs, never mutates
 * the registry, and never fabricates content.
 *
 * Identity linkage: prefers `bodyModel + structureKey`; ontology is
 * preserved but does not override the bodyModel-qualified key, so
 * male/female with the same ontology remain distinct.
 */
export function getAnatomyInformation(
  selection: AnatomySelection | null | undefined
): AnatomyInformation | undefined {
  if (!selection || !selection.structureKey) return undefined;
  return byStructureKey.get(selection.structureKey);
}

/** Lookup by the primary bodyModel-qualified key. */
export function getAnatomyInformationByStructureKey(
  structureKey: string | null | undefined
): AnatomyInformation | undefined {
  if (!structureKey) return undefined;
  return byStructureKey.get(structureKey);
}

/**
 * Lookup by ontologyId.
 * When `bodyModel` is provided, returns the body-specific record.
 * When omitted and the ontology is ambiguous (e.g., skin in both
 * male and female), returns undefined to avoid cross-body collision.
 */
export function getAnatomyInformationByOntologyId(
  ontologyId: string | null | undefined,
  bodyModel?: AnatomyBodyModelKey
): AnatomyInformation | undefined {
  if (!ontologyId) return undefined;
  const list = byOntology.get(ontologyId);
  if (!list || list.length === 0) return undefined;
  if (bodyModel) {
    return list.find(entry => entry.bodyModel === bodyModel);
  }
  if (list.length === 1) return list[0];
  return undefined;
}

/** Exposed for tests — seed size without leaking mutable map. */
export function getAnatomyInformationSeed(): readonly AnatomyInformation[] {
  return ANATOMY_INFORMATION_SEED;
}

/** All stored keys — useful for documentation/tests. */
export function getAnatomyInformationKeys(): readonly string[] {
  return [...byStructureKey.keys()];
}
