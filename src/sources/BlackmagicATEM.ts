
import { Atem, listVisibleInputs } from 'atem-connection';
import { logger } from '..';
import { RegisterTallyInput } from "../_decorators/RegisterTallyInput.decorator";
import { UsesPort } from '../_decorators/UsesPort.decorator';
import { Source } from '../_models/Source';
import { TallyInput } from './_Source';

@RegisterTallyInput("44b8bc4f", "Blackmagic ATEM", "Uses Port 9910.", [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    {
        fieldName: 'me_onair', fieldLabel: 'MEs to monitor', fieldType: 'multiselect',
        options: [
            { id: '1', label: 'ME 1' },
            { id: '2', label: 'ME 2' },
            { id: '3', label: 'ME 3' },
            { id: '4', label: 'ME 4' },
            { id: '5', label: 'ME 5' },
            { id: '6', label: 'ME 6' },
        ],
    },
    {
        fieldName: 'cut_bus_mode',
        fieldLabel: 'Bus Mode',
        fieldType: 'dropdown',
        options: [
            { id: 'off', label: 'Preview / Program Mode' },
            { id: 'on', label: 'Cut Bus Mode' }
        ],
    },
])
@UsesPort("9910")
export class ATEMSource extends TallyInput {
    private atemClient: Atem;
    constructor(source: Source) {
        super(source);


        let atemIP = source.data.ip;
        logger(`Source: ${source.name}  Creating ATEM Connection.`, 'info-quiet');
        this.atemClient = new Atem();

        this.atemClient.on('connected', () => {
            this.connected.next(true);
            logger(`Source: ${source.name} ATEM connection opened.`, 'info');
        });

        this.atemClient.on('disconnected', () => {
            this.connected.next(false);
            logger(`Source: ${source.name} ATEM connection closed.`, 'info');
        });

        this.atemClient.on('stateChanged', (state, path) => {
            for (let h = 0; h < path.length; h++) {
                if (path[h] === 'info.capabilities') {
                    //console.log(state.info.capabilities);
                }
                else if ((path[h].indexOf('video.mixEffects') > -1) || (path[h].indexOf('video.ME') > -1) || (path[h].indexOf('video.downstreamKeyers') > -1)) {
                    const pgmList = [], prvList = [];
                    const addUniqueInput = (n, list) => {
                        const s = n.toString();
                        if (!list.includes(s)) list.push(s);
                    }
                    for (let i = 0; i < state.video.mixEffects.length; i++) {
                        if (source.data.me_onair.includes((i + 1).toString())) {
                            listVisibleInputs("program", state, i).forEach(n => addUniqueInput(n, pgmList));
                            listVisibleInputs("preview", state, i).forEach(n => addUniqueInput(n, prvList));
                        }
                    }
                    this.processATEMTally(pgmList, prvList);
                }
            }
        });

        this.atemClient.on('info', console.log);
        this.atemClient.on('error', console.error);

        this.atemClient.connect(atemIP);
    }

    private processATEMTally(allPrograms, allPreviews) {
    
        let cutBusMode = this.source.data.cut_bus_mode;
    
        //loop through the array of program inputs;
        //if that program input is also in the preview array, build a TSL-type object that has it in pvw+pgm
        //if only pgm, build an object of only pgm
    
        if (cutBusMode === 'on') {
            for (let i = 0; i < allPrograms.length; i++) {
                let tallyObj: any = {};
                tallyObj.address = allPrograms[i];
                tallyObj.brightness = 1;
                tallyObj.tally1 = 0;
                tallyObj.preview = 0;
                tallyObj.tally2 = 1;
                tallyObj.program = 1;
                tallyObj.tally3 = 0;
                tallyObj.tally4 = 0;
                tallyObj.label = `Source ${allPrograms[i]}`;
                this.tally.next(tallyObj);
            }
        } else {
            for (let i = 0; i < allPrograms.length; i++) {
                let includePreview = false;
                if (allPreviews.includes(allPrograms[i])) {
                    includePreview = true;
                }
        
                let tallyObj: any = {};
                tallyObj.address = allPrograms[i];
                tallyObj.brightness = 1;
                tallyObj.tally1 = (includePreview ? 1 : 0);
                tallyObj.preview = (includePreview ? 1 : 0);
                tallyObj.tally2 = 1;
                tallyObj.program = 1;
                tallyObj.tally3 = 0;
                tallyObj.tally4 = 0;
                tallyObj.label = `Source ${allPrograms[i]}`;
                this.tally.next(tallyObj);
            }
        }
    
        //now loop through the array of pvw inputs
        //if that input is not in the program array, build a TSL object of only pvw
    
        if (cutBusMode === 'on') {
            for (let i = 0; i < allPreviews.length; i++) {
                let onlyPreview = true;
        
                if (allPrograms.includes(allPreviews[i])) {
                    onlyPreview = false;
                }
        
                if (onlyPreview) {
                    let tallyObj: any = {};
                    tallyObj.address = allPreviews[i];
                    tallyObj.brightness = 1;
                    tallyObj.tally1 = 0;
                    tallyObj.preview = 0;
                    tallyObj.tally2 = 0;
                    tallyObj.program = 0;
                    tallyObj.tally3 = 0;
                    tallyObj.tally4 = 0;
                    tallyObj.label = `Source ${allPreviews[i]}`;
                    this.tally.next(tallyObj);
                }
            }
        } else {
            for (let i = 0; i < allPreviews.length; i++) {
                let onlyPreview = true;
        
                if (allPrograms.includes(allPreviews[i])) {
                    onlyPreview = false;
                }
        
                if (onlyPreview) {
                    let tallyObj: any = {};
                    tallyObj.address = allPreviews[i];
                    tallyObj.brightness = 1;
                    tallyObj.tally1 = 1;
                    tallyObj.preview = 1;
                    tallyObj.tally2 = 0;
                    tallyObj.program = 0;
                    tallyObj.tally3 = 0;
                    tallyObj.tally4 = 0;
                    tallyObj.label = `Source ${allPreviews[i]}`;
                    this.tally.next(tallyObj);
                }
            }
        }
    }

    public exit(): void {
        this.atemClient.disconnect();
        super.exit();
    }
}
