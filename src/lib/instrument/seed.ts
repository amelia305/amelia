import type { Question } from '$lib/types/index.js';
import type { Role } from '$lib/types/index.js';

// ─── Instrument version ───────────────────────────────────────────────────────

export const INSTRUMENT_VERSION = 1 as const;

// ─── Pillar names (Spanish — user-facing UI labels) ───────────────────────────

export const PILLAR_NAMES: Record<Role, Record<1 | 2 | 3 | 4 | 5 | 6, string>> = {
  executive: {
    1: 'Resiliencia',
    2: 'Vínculo Identitario',
    3: 'Sostenibilidad',
    4: 'Capital Social',
    5: 'Psicología Financiera',
    6: 'Liderazgo e Impacto Mental',
  },
  middleManagement: {
    1: 'Resiliencia',
    2: 'Vínculo Identitario',
    3: 'Sostenibilidad',
    4: 'Capital Social',
    5: 'Psicología Financiera',
    6: 'Liderazgo y Gestión Emocional',
  },
  operational: {
    1: 'Resiliencia',
    2: 'Sentido de Pertenencia',
    3: 'Sostenibilidad',
    4: 'Capital Social',
    5: 'Bienestar Financiero',
    6: 'Autoliderazgo y Proactividad',
  },
} as const;

// ─── Questions ────────────────────────────────────────────────────────────────
// IDs follow: <role>-p<pillar>-q<1..7>
// (R) prefix in source → reverse: true; stripped from text.
// Exactly 42 questions per role: 7 per pillar × 6 pillars.

const executiveQuestions: readonly Question[] = [
  // Pilar 1 — Resiliencia (Enfoque Interno)
  {
    id: 'executive-p1-q1',
    pillar: 1,
    text: 'Considero que los contratiempos y "fracasos" son oportunidades valiosas de aprendizaje personal.',
    reverse: false,
  },
  {
    id: 'executive-p1-q2',
    pillar: 1,
    text: 'Cuando me enfrento a un problema complejo, confío en mi capacidad intelectual para resolverlo.',
    reverse: false,
  },
  {
    id: 'executive-p1-q3',
    pillar: 1,
    text: 'La incertidumbre sobre el futuro del mercado me genera ansiedad paralizante.',
    reverse: true,
  },
  {
    id: 'executive-p1-q4',
    pillar: 1,
    text: 'Mantengo una visión optimista, incluso cuando los datos externos son desalentadores.',
    reverse: false,
  },
  {
    id: 'executive-p1-q5',
    pillar: 1,
    text: 'Un revés importante en el negocio me hace dudar de mis capacidades personales.',
    reverse: true,
  },
  {
    id: 'executive-p1-q6',
    pillar: 1,
    text: 'Tengo la flexibilidad mental para cambiar de opinión si la evidencia lo sugiere.',
    reverse: false,
  },
  {
    id: 'executive-p1-q7',
    pillar: 1,
    text: 'Me cuesta mucho recuperarme emocionalmente después de perder un cliente o un negocio clave.',
    reverse: true,
  },

  // Pilar 2 — Vínculo Identitario
  {
    id: 'executive-p2-q1',
    pillar: 2,
    text: 'Mi sentido de valía personal es independiente del éxito o fracaso de mi empresa.',
    reverse: false,
  },
  {
    id: 'executive-p2-q2',
    pillar: 2,
    text: 'Si mi empresa quebrara, sentiría que dejo de ser alguien importante.',
    reverse: true,
  },
  {
    id: 'executive-p2-q3',
    pillar: 2,
    text: 'Tengo pasiones e intereses que cultivo activamente fuera de mi rol de fundador.',
    reverse: false,
  },
  {
    id: 'executive-p2-q4',
    pillar: 2,
    text: 'Concibo mi empresa como un proyecto de vida, pero no como mi vida entera.',
    reverse: false,
  },
  {
    id: 'executive-p2-q5',
    pillar: 2,
    text: 'Me siento culpable cuando dedico tiempo a actividades que no generan dinero.',
    reverse: true,
  },
  {
    id: 'executive-p2-q6',
    pillar: 2,
    text: 'Puedo celebrar los logros de la empresa sin que estos inflen mi ego desmedidamente.',
    reverse: false,
  },
  {
    id: 'executive-p2-q7',
    pillar: 2,
    text: 'Mi estado de ánimo diario depende casi exclusivamente de las métricas de ventas.',
    reverse: true,
  },

  // Pilar 3 — Sostenibilidad (Energía)
  {
    id: 'executive-p3-q1',
    pillar: 3,
    text: 'Priorizo mis horas de sueño, entendiendo que son mi principal activo productivo.',
    reverse: false,
  },
  {
    id: 'executive-p3-q2',
    pillar: 3,
    text: 'A menudo salto comidas o como mal debido a la agenda laboral.',
    reverse: true,
  },
  {
    id: 'executive-p3-q3',
    pillar: 3,
    text: 'Establezco rituales claros para desconectar mentalmente antes de dormir.',
    reverse: false,
  },
  {
    id: 'executive-p3-q4',
    pillar: 3,
    text: 'Siento un cansancio crónico que no desaparece ni los fines de semana.',
    reverse: true,
  },
  {
    id: 'executive-p3-q5',
    pillar: 3,
    text: 'Dedico tiempo semanal al ejercicio físico o meditación para gestionar el cortisol.',
    reverse: false,
  },
  {
    id: 'executive-p3-q6',
    pillar: 3,
    text: 'Respeto mis propios tiempos de vacaciones y descanso sin excusas.',
    reverse: false,
  },
  {
    id: 'executive-p3-q7',
    pillar: 3,
    text: 'Siento que mi cuerpo me está enviando señales de alerta (dolores, insomnio) que ignoro.',
    reverse: true,
  },

  // Pilar 4 — Capital Social (Apoyo)
  {
    id: 'executive-p4-q1',
    pillar: 4,
    text: 'Tengo un círculo de confianza (fuera de la empresa) con el que puedo ser vulnerable.',
    reverse: false,
  },
  {
    id: 'executive-p4-q2',
    pillar: 4,
    text: 'Siento que nadie entiende realmente la presión que tengo encima.',
    reverse: true,
  },
  {
    id: 'executive-p4-q3',
    pillar: 4,
    text: 'Busco activamente mentores o pares empresarios para compartir experiencias.',
    reverse: false,
  },
  {
    id: 'executive-p4-q4',
    pillar: 4,
    text: 'Me aíslo socialmente cuando las cosas van mal en el negocio.',
    reverse: true,
  },
  {
    id: 'executive-p4-q5',
    pillar: 4,
    text: 'Invierto tiempo en mi familia y amigos, protegiendo esos espacios.',
    reverse: false,
  },
  {
    id: 'executive-p4-q6',
    pillar: 4,
    text: 'Tengo personas a las que puedo llamar a las 3 AM si tengo una crisis personal.',
    reverse: false,
  },
  {
    id: 'executive-p4-q7',
    pillar: 4,
    text: 'He perdido amistades importantes por mi obsesión con la empresa.',
    reverse: true,
  },

  // Pilar 5 — Psicología Financiera
  {
    id: 'executive-p5-q1',
    pillar: 5,
    text: 'Tomo decisiones de inversión desde la estrategia, no desde el pánico.',
    reverse: false,
  },
  {
    id: 'executive-p5-q2',
    pillar: 5,
    text: 'El flujo de caja de la empresa es mi principal fuente de insomnio.',
    reverse: true,
  },
  {
    id: 'executive-p5-q3',
    pillar: 5,
    text: 'Mi relación con el dinero es de abundancia y oportunidad.',
    reverse: false,
  },
  {
    id: 'executive-p5-q4',
    pillar: 5,
    text: 'Siento ansiedad física al revisar las cuentas bancarias.',
    reverse: true,
  },
  {
    id: 'executive-p5-q5',
    pillar: 5,
    text: 'Tengo separado claramente mi patrimonio personal de las finanzas de la empresa.',
    reverse: false,
  },
  {
    id: 'executive-p5-q6',
    pillar: 5,
    text: 'Confío en mi capacidad para volver a generar riqueza si lo perdiera todo.',
    reverse: false,
  },
  {
    id: 'executive-p5-q7',
    pillar: 5,
    text: 'Comparo mi patrimonio constantemente con el de otros emprendedores exitosos.',
    reverse: true,
  },

  // Pilar 6 — Liderazgo e Impacto Mental
  {
    id: 'executive-p6-q1',
    pillar: 6,
    text: 'Soy capaz de delegar responsabilidades importantes sin sentir angustia o necesidad de controlarlo todo (micromanagement).',
    reverse: false,
  },
  {
    id: 'executive-p6-q2',
    pillar: 6,
    text: 'Me frustra profundamente cuando mi equipo no avanza a la velocidad que yo pienso.',
    reverse: true,
  },
  {
    id: 'executive-p6-q3',
    pillar: 6,
    text: 'Logro transmitir mi visión al equipo de forma que ellos la hagan propia, lo cual me quita peso de encima.',
    reverse: false,
  },
  {
    id: 'executive-p6-q4',
    pillar: 6,
    text: 'Siento que soy el único que "hala del carro" y eso me agota emocionalmente.',
    reverse: true,
  },
  {
    id: 'executive-p6-q5',
    pillar: 6,
    text: 'Cuando hay un error en el equipo, mi primera reacción es buscar la solución, no al culpable.',
    reverse: false,
  },
  {
    id: 'executive-p6-q6',
    pillar: 6,
    text: 'Disfruto viendo crecer a mis líderes, incluso si eso significa que me necesiten menos.',
    reverse: false,
  },
  {
    id: 'executive-p6-q7',
    pillar: 6,
    text: 'A veces siento que mi equipo es una carga más que un apoyo.',
    reverse: true,
  },
] as const;

const middleManagementQuestions: readonly Question[] = [
  // Pilar 1 — Resiliencia (Gestión de la Presión)
  {
    id: 'middleManagement-p1-q1',
    pillar: 1,
    text: 'Me adapto con rapidez cuando la dirección cambia las prioridades estratégicas.',
    reverse: false,
  },
  {
    id: 'middleManagement-p1-q2',
    pillar: 1,
    text: 'Me tomo las críticas de mis superiores como un ataque a mi persona.',
    reverse: true,
  },
  {
    id: 'middleManagement-p1-q3',
    pillar: 1,
    text: 'Veo los problemas operativos como acertijos a resolver, no como tragedias.',
    reverse: false,
  },
  {
    id: 'middleManagement-p1-q4',
    pillar: 1,
    text: 'La presión por cumplir las metas mensuales me genera ansiedad constante.',
    reverse: true,
  },
  {
    id: 'middleManagement-p1-q5',
    pillar: 1,
    text: 'Soy capaz de mantener la calma cuando todo a mi alrededor parece urgente.',
    reverse: false,
  },
  {
    id: 'middleManagement-p1-q6',
    pillar: 1,
    text: 'Tengo herramientas para gestionar mi frustración cuando las cosas no salen bien.',
    reverse: false,
  },
  {
    id: 'middleManagement-p1-q7',
    pillar: 1,
    text: 'Me quedo "rumiando" (pensando obsesivamente) en los problemas del trabajo cuando estoy en casa.',
    reverse: true,
  },

  // Pilar 2 — Vínculo Identitario (Alineación)
  {
    id: 'middleManagement-p2-q1',
    pillar: 2,
    text: 'Encuentro sentido y propósito en el trabajo que realizo diariamente.',
    reverse: false,
  },
  {
    id: 'middleManagement-p2-q2',
    pillar: 2,
    text: 'Siento que tengo que usar una "máscara" y fingir ser alguien que no soy en la oficina.',
    reverse: true,
  },
  {
    id: 'middleManagement-p2-q3',
    pillar: 2,
    text: 'Me siento orgulloso de pertenecer a esta organización.',
    reverse: false,
  },
  {
    id: 'middleManagement-p2-q4',
    pillar: 2,
    text: 'Mis valores personales están alineados con los valores que la empresa practica.',
    reverse: false,
  },
  {
    id: 'middleManagement-p2-q5',
    pillar: 2,
    text: 'Siento que soy fácilmente reemplazable y eso me genera inseguridad.',
    reverse: true,
  },
  {
    id: 'middleManagement-p2-q6',
    pillar: 2,
    text: 'Mi rol me permite utilizar mis mejores talentos y fortalezas.',
    reverse: false,
  },
  {
    id: 'middleManagement-p2-q7',
    pillar: 2,
    text: 'Si perdiera este cargo, sentiría que fracasé en la vida.',
    reverse: true,
  },

  // Pilar 3 — Sostenibilidad (Límites)
  {
    id: 'middleManagement-p3-q1',
    pillar: 3,
    text: 'Respeto mis horarios de salida y desconexión digital.',
    reverse: false,
  },
  {
    id: 'middleManagement-p3-q2',
    pillar: 3,
    text: 'Reviso correos o mensajes de trabajo estando en la cama o en familia.',
    reverse: true,
  },
  {
    id: 'middleManagement-p3-q3',
    pillar: 3,
    text: 'Gestiono mi carga laboral para no llegar al agotamiento extremo (burnout).',
    reverse: false,
  },
  {
    id: 'middleManagement-p3-q4',
    pillar: 3,
    text: 'A menudo trabajo enfermo o salto mis horas de almuerzo para cumplir.',
    reverse: true,
  },
  {
    id: 'middleManagement-p3-q5',
    pillar: 3,
    text: 'Tengo hobbies o actividades fuera del trabajo que me dan energía.',
    reverse: false,
  },
  {
    id: 'middleManagement-p3-q6',
    pillar: 3,
    text: 'Siento que tengo permiso implícito de la cultura de la empresa para descansar.',
    reverse: false,
  },
  {
    id: 'middleManagement-p3-q7',
    pillar: 3,
    text: 'Me siento culpable si no estoy disponible 24/7 para mi jefe o equipo.',
    reverse: true,
  },

  // Pilar 4 — Capital Social (Respaldo)
  {
    id: 'middleManagement-p4-q1',
    pillar: 4,
    text: 'Cuento con pares (otros gerentes/líderes) con quienes puedo desahogarme.',
    reverse: false,
  },
  {
    id: 'middleManagement-p4-q2',
    pillar: 4,
    text: 'Me siento aislado y sin apoyo dentro de la estructura de la empresa.',
    reverse: true,
  },
  {
    id: 'middleManagement-p4-q3',
    pillar: 4,
    text: 'Siento que mis superiores me respaldan en las decisiones difíciles.',
    reverse: false,
  },
  {
    id: 'middleManagement-p4-q4',
    pillar: 4,
    text: 'El ambiente entre las áreas es de competencia desleal o política tóxica.',
    reverse: true,
  },
  {
    id: 'middleManagement-p4-q5',
    pillar: 4,
    text: 'Tengo una red de apoyo personal (familia/amigos) sólida fuera del trabajo.',
    reverse: false,
  },
  {
    id: 'middleManagement-p4-q6',
    pillar: 4,
    text: 'Puedo ser vulnerable y admitir "no sé" frente a mis colegas sin ser juzgado.',
    reverse: false,
  },
  {
    id: 'middleManagement-p4-q7',
    pillar: 4,
    text: 'Siento que estoy solo "entre la espada y la pared" (entre jefes y equipo).',
    reverse: true,
  },

  // Pilar 5 — Psicología Financiera (Equidad)
  {
    id: 'middleManagement-p5-q1',
    pillar: 5,
    text: 'Considero que mi compensación es justa para la responsabilidad que manejo.',
    reverse: false,
  },
  {
    id: 'middleManagement-p5-q2',
    pillar: 5,
    text: 'Me angustia que mi salario no crezca al ritmo de la inflación o mis necesidades.',
    reverse: true,
  },
  {
    id: 'middleManagement-p5-q3',
    pillar: 5,
    text: 'Veo un camino claro de crecimiento económico dentro de la empresa.',
    reverse: false,
  },
  {
    id: 'middleManagement-p5-q4',
    pillar: 5,
    text: 'Siento envidia o resentimiento por los beneficios de otros líderes.',
    reverse: true,
  },
  {
    id: 'middleManagement-p5-q5',
    pillar: 5,
    text: 'Mis finanzas personales están ordenadas y no me generan estrés en horario laboral.',
    reverse: false,
  },
  {
    id: 'middleManagement-p5-q6',
    pillar: 5,
    text: 'Percibo equilibrio entre mi esfuerzo y la recompensa económica recibida.',
    reverse: false,
  },
  {
    id: 'middleManagement-p5-q7',
    pillar: 5,
    text: 'Mis deudas personales afectan mi concentración en el trabajo.',
    reverse: true,
  },

  // Pilar 6 — Liderazgo y Gestión Emocional
  {
    id: 'middleManagement-p6-q1',
    pillar: 6,
    text: 'Me siento capacitado para manejar las emociones y crisis personales de mis colaboradores.',
    reverse: false,
  },
  {
    id: 'middleManagement-p6-q2',
    pillar: 6,
    text: 'Me cargo con los problemas de mi equipo y me los llevo a casa.',
    reverse: true,
  },
  {
    id: 'middleManagement-p6-q3',
    pillar: 6,
    text: 'Puedo dar feedback correctivo de manera firme pero empática.',
    reverse: false,
  },
  {
    id: 'middleManagement-p6-q4',
    pillar: 6,
    text: 'Evito tener conversaciones difíciles con mi equipo por miedo al conflicto.',
    reverse: true,
  },
  {
    id: 'middleManagement-p6-q5',
    pillar: 6,
    text: 'Siento satisfacción al ver que mi equipo se desarrolla y crece.',
    reverse: false,
  },
  {
    id: 'middleManagement-p6-q6',
    pillar: 6,
    text: 'Soy capaz de filtrar la presión que viene de arriba para no transmitírsela con estrés a mi equipo.',
    reverse: false,
  },
  {
    id: 'middleManagement-p6-q7',
    pillar: 6,
    text: 'A veces siento que tengo que hacer el trabajo de mi equipo porque no confío en que lo hagan bien.',
    reverse: true,
  },
] as const;

const operationalQuestions: readonly Question[] = [
  // Pilar 1 — Resiliencia (Adaptabilidad)
  {
    id: 'operational-p1-q1',
    pillar: 1,
    text: 'Entiendo que cometer errores es parte del proceso de aprender, siempre que los corrija.',
    reverse: false,
  },
  {
    id: 'operational-p1-q2',
    pillar: 1,
    text: 'Me bloqueo o me asusto mucho cuando algo sale mal en mi tarea.',
    reverse: true,
  },
  {
    id: 'operational-p1-q3',
    pillar: 1,
    text: 'Me adapto bien a los cambios de instrucciones o prioridades.',
    reverse: false,
  },
  {
    id: 'operational-p1-q4',
    pillar: 1,
    text: 'Los cambios constantes en la empresa me hacen sentir inestable e inseguro.',
    reverse: true,
  },
  {
    id: 'operational-p1-q5',
    pillar: 1,
    text: 'Tengo confianza en mis habilidades para hacer bien mi trabajo.',
    reverse: false,
  },
  {
    id: 'operational-p1-q6',
    pillar: 1,
    text: 'Pido ayuda a tiempo cuando no sé cómo resolver algo.',
    reverse: false,
  },
  {
    id: 'operational-p1-q7',
    pillar: 1,
    text: 'Siento que cualquier pequeño error podría costarme el puesto.',
    reverse: true,
  },

  // Pilar 2 — Sentido de Pertenencia
  {
    id: 'operational-p2-q1',
    pillar: 2,
    text: 'Me gusta contarle a la gente que trabajo en esta empresa.',
    reverse: false,
  },
  {
    id: 'operational-p2-q2',
    pillar: 2,
    text: 'Siento que soy solo un número más para la compañía.',
    reverse: true,
  },
  {
    id: 'operational-p2-q3',
    pillar: 2,
    text: 'Entiendo la importancia de mi trabajo para el resultado final de la empresa.',
    reverse: false,
  },
  {
    id: 'operational-p2-q4',
    pillar: 2,
    text: 'Vengo a trabajar solo por el dinero, no porque me guste.',
    reverse: true,
  },
  {
    id: 'operational-p2-q5',
    pillar: 2,
    text: 'Me siento motivado a hacer mi trabajo con calidad.',
    reverse: false,
  },
  {
    id: 'operational-p2-q6',
    pillar: 2,
    text: 'Siento que la empresa respeta mis valores y principios.',
    reverse: false,
  },
  {
    id: 'operational-p2-q7',
    pillar: 2,
    text: 'A menudo pienso en renunciar.',
    reverse: true,
  },

  // Pilar 3 — Sostenibilidad (Fatiga)
  {
    id: 'operational-p3-q1',
    pillar: 3,
    text: 'Tengo energía para disfrutar de mi vida personal al salir del trabajo.',
    reverse: false,
  },
  {
    id: 'operational-p3-q2',
    pillar: 3,
    text: 'Llego a casa tan cansado que solo quiero dormir.',
    reverse: true,
  },
  {
    id: 'operational-p3-q3',
    pillar: 3,
    text: 'Mis condiciones físicas de trabajo (silla, luz, equipos) son adecuadas y no me enferman.',
    reverse: false,
  },
  {
    id: 'operational-p3-q4',
    pillar: 3,
    text: 'El ritmo de trabajo es tan rápido que no puedo ni ir al baño tranquilo.',
    reverse: true,
  },
  {
    id: 'operational-p3-q5',
    pillar: 3,
    text: 'Respetan mis días libres y vacaciones sin molestarme.',
    reverse: false,
  },
  {
    id: 'operational-p3-q6',
    pillar: 3,
    text: 'Duermo bien y me levanto descansado para ir a trabajar.',
    reverse: false,
  },
  {
    id: 'operational-p3-q7',
    pillar: 3,
    text: 'Siento dolores de cabeza, espalda o estómago frecuentes por el trabajo.',
    reverse: true,
  },

  // Pilar 4 — Capital Social (Compañerismo)
  {
    id: 'operational-p4-q1',
    pillar: 4,
    text: 'Me llevo bien con mis compañeros de trabajo.',
    reverse: false,
  },
  {
    id: 'operational-p4-q2',
    pillar: 4,
    text: 'Hay mucho chisme y mal ambiente en mi grupo de trabajo.',
    reverse: true,
  },
  {
    id: 'operational-p4-q3',
    pillar: 4,
    text: 'Siento que puedo confiar en mi jefe directo si tengo un problema.',
    reverse: false,
  },
  {
    id: 'operational-p4-q4',
    pillar: 4,
    text: 'Me da miedo hablar con mis superiores.',
    reverse: true,
  },
  {
    id: 'operational-p4-q5',
    pillar: 4,
    text: 'En mi equipo nos ayudamos cuando alguien tiene mucho trabajo.',
    reverse: false,
  },
  {
    id: 'operational-p4-q6',
    pillar: 4,
    text: 'Me siento incluido y parte del grupo.',
    reverse: false,
  },
  {
    id: 'operational-p4-q7',
    pillar: 4,
    text: 'Me siento ignorado o excluido por mis compañeros.',
    reverse: true,
  },

  // Pilar 5 — Bienestar Financiero
  {
    id: 'operational-p5-q1',
    pillar: 5,
    text: 'Mi salario me alcanza para cubrir mis necesidades básicas con tranquilidad.',
    reverse: false,
  },
  {
    id: 'operational-p5-q2',
    pillar: 5,
    text: 'Estoy constantemente preocupado por deudas o falta de dinero.',
    reverse: true,
  },
  {
    id: 'operational-p5-q3',
    pillar: 5,
    text: 'Siento que me pagan lo justo por el trabajo que hago.',
    reverse: false,
  },
  {
    id: 'operational-p5-q4',
    pillar: 5,
    text: 'Tengo que buscar dinero prestado para llegar a fin de mes.',
    reverse: true,
  },
  {
    id: 'operational-p5-q5',
    pillar: 5,
    text: 'Veo estabilidad en mi empleo y eso me da paz.',
    reverse: false,
  },
  {
    id: 'operational-p5-q6',
    pillar: 5,
    text: 'Los beneficios extra (seguros, auxilios) de la empresa me ayudan mucho.',
    reverse: false,
  },
  {
    id: 'operational-p5-q7',
    pillar: 5,
    text: 'Comparo mi sueldo con el de mis compañeros y me da rabia.',
    reverse: true,
  },

  // Pilar 6 — Autoliderazgo y Proactividad
  {
    id: 'operational-p6-q1',
    pillar: 6,
    text: 'A menudo propongo ideas o mejoras para hacer mi trabajo más eficiente.',
    reverse: false,
  },
  {
    id: 'operational-p6-q2',
    pillar: 6,
    text: 'Prefiero quedarme callado y hacer solo lo que me dicen, aunque vea una forma mejor.',
    reverse: true,
  },
  {
    id: 'operational-p6-q3',
    pillar: 6,
    text: 'Me hago responsable de mis tareas sin necesidad de que me estén vigilando.',
    reverse: false,
  },
  {
    id: 'operational-p6-q4',
    pillar: 6,
    text: 'Siento que no tengo voz ni voto en lo que pasa en mi área.',
    reverse: true,
  },
  {
    id: 'operational-p6-q5',
    pillar: 6,
    text: 'Trato de influir positivamente en el ánimo de mis compañeros.',
    reverse: false,
  },
  {
    id: 'operational-p6-q6',
    pillar: 6,
    text: 'Busco aprender cosas nuevas por mi cuenta para ser mejor en mi labor.',
    reverse: false,
  },
  {
    id: 'operational-p6-q7',
    pillar: 6,
    text: 'Espero a que otros me solucionen los problemas que aparecen en mi día a día.',
    reverse: true,
  },
] as const;

// ─── Pillar intros (Spanish — conversational framing before each pillar) ─────
// Tone: executive → peer-level/strategic; middleManagement → practical/action-oriented; operational → simple/direct.

export const PILLAR_INTROS: Record<Role, Record<1 | 2 | 3 | 4 | 5 | 6, string>> = {
  executive: {
    1: 'Empecemos con <strong>Resiliencia</strong>. Como líder, tu capacidad de sostener el rumbo ante la adversidad impacta directamente en toda la organización. Responde con la mayor honestidad posible — no hay respuestas correctas ni incorrectas.',
    2: 'Segundo pilar: <strong>Vínculo Identitario</strong>. Exploraremos cómo defines tu valía más allá del rendimiento de la empresa. La diferenciación entre fundador y organización es uno de los indicadores más críticos de salud mental sostenible.',
    3: 'Tercer pilar: <strong>Sostenibilidad</strong>. Tu energía es el activo más estratégico que gestionas. Estas preguntas exploran cómo proteges y renuevas ese recurso en el día a día.',
    4: 'Cuarto pilar: <strong>Capital Social</strong>. Las redes de apoyo genuino son un diferenciador crítico en la longevidad de los líderes. Evalúa con honestidad la calidad de tus vínculos.',
    5: 'Quinto pilar: <strong>Psicología Financiera</strong>. No se trata del estado de tus cuentas, sino de tu relación emocional con el dinero y la incertidumbre económica.',
    6: 'Último pilar: <strong>Liderazgo e Impacto Mental</strong>. Aquí medimos cómo tu estado interno se traduce — o no — en la cultura y el desempeño de tu equipo.',
  },
  middleManagement: {
    1: 'Comenzamos con <strong>Resiliencia</strong>. Como mando medio, gestionas presión desde arriba y desde abajo. Estas preguntas evalúan cómo manejas esa tensión sin que te consuma.',
    2: 'Segundo pilar: <strong>Vínculo Identitario</strong>. Exploraremos si tu sentido de propósito está alineado con el rol que desempeñas, o si sientes una brecha entre quién eres y lo que haces en el trabajo.',
    3: 'Tercer pilar: <strong>Sostenibilidad</strong>. La gestión de límites y la recuperación de energía son habilidades críticas para cualquier líder intermedio. Evalúa con honestidad tus hábitos reales.',
    4: 'Cuarto pilar: <strong>Capital Social</strong>. Tener respaldo — de pares, superiores y redes personales — hace la diferencia cuando el trabajo se pone difícil. Analicemos cómo está tu red de apoyo.',
    5: 'Quinto pilar: <strong>Psicología Financiera</strong>. Tu relación con la compensación y la equidad salarial afecta tu motivación y claridad mental en el trabajo. Responde con sinceridad.',
    6: 'Último pilar: <strong>Liderazgo y Gestión Emocional</strong>. Evalúa cómo manejas las dinámicas emocionales de tu equipo — sin perder tu propio equilibrio en el proceso.',
  },
  operational: {
    1: 'Empecemos con <strong>Resiliencia</strong>. Vamos a ver cómo te adaptas cuando las cosas no salen como se esperaba. No hay respuestas buenas ni malas — lo importante es ser honesto/a.',
    2: 'Segundo bloque: <strong>Sentido de Pertenencia</strong>. Estas preguntas son sobre cómo te sientes siendo parte de esta empresa y de tu equipo.',
    3: 'Tercer bloque: <strong>Sostenibilidad</strong>. Vamos a hablar de cómo el trabajo afecta tu energía y tu cuerpo. Sé directo/a con lo que realmente vives.',
    4: 'Cuarto bloque: <strong>Capital Social</strong>. Este grupo de preguntas es sobre tus compañeros, tu jefe y cómo te llevas con la gente en el trabajo.',
    5: 'Quinto bloque: <strong>Bienestar Financiero</strong>. Ahora hablamos de tu tranquilidad con el dinero y si sientes que lo que te pagan es justo.',
    6: 'Último bloque: <strong>Autoliderazgo y Proactividad</strong>. Las últimas preguntas son sobre cómo actúas por tu cuenta — sin que nadie te lo tenga que pedir.',
  },
} as const;

// ─── Exports ──────────────────────────────────────────────────────────────────

export const QUESTIONS: Record<Role, readonly Question[]> = {
  executive: executiveQuestions,
  middleManagement: middleManagementQuestions,
  operational: operationalQuestions,
} as const;

/** Pure function — returns the question list for a given role. */
export function getQuestions(role: Role): readonly Question[] {
  return QUESTIONS[role];
}
