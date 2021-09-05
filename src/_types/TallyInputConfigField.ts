export type TallyInputConfigField = {
    fieldName: string;
    fieldLabel: string;
} & ({
    fieldType: 'text' | 'port';
} | {
    fieldType: "dropdown" | "multiselect";
    options: {
        id: string;
        label: string;
    }[]
} | {
    fieldType: 'info',
    text: string;
    })
