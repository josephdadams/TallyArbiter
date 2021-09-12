
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
export class BlackmagicATEMSource extends TallyInput {
    private atemClient: Atem;
    constructor(source: Source) {
        super(source);


        let atemIP = source.data.ip;
        this.atemClient = new Atem();

        this.atemClient.on('connected', () => {
            this.connected.next(true);
            const pgmList = new Set<number>();
            const prvList = new Set<number>();
            this.processATEMState(this.atemClient.state, pgmList, prvList);
            this.processATEMTally(pgmList, prvList);
        });

        this.atemClient.on('disconnected', () => {
            this.connected.next(false);
        });

        this.atemClient.on('stateChanged', (state, path) => {
            const pgmList = new Set<number>();
            const prvList = new Set<number>();
            for (let h = 0; h < path.length; h++) {
                if (path[h] === 'info.capabilities') {
                    //console.log(state.info.capabilities);
                }
                else if ((path[h].indexOf('video.mixEffects') > -1) || (path[h].indexOf('video.ME') > -1) || (path[h].indexOf('video.downstreamKeyers') > -1)) {
                    this.processATEMState(state, pgmList, prvList);
                }
            }
            this.processATEMTally(pgmList, prvList);
        });

        // this.atemClient.on('info', console.log);
        this.atemClient.on('error', console.error);

        this.atemClient.connect(atemIP);
    }

    private processATEMState(state, pgmList: Set<number>, prvList: Set<number>) {
        for (let i = 0; i < state.video.mixEffects.length; i++) {
            if (this.source.data.me_onair.includes((i + 1).toString())) {
                listVisibleInputs("program", state, i).forEach(n => pgmList.add(n));
                listVisibleInputs("preview", state, i).forEach(n => prvList.add(n));
            }
        }
    }

    private processATEMTally(allPrograms: Set<number>, allPreviews: Set<number>): void {
        this.removeBusFromAllAddresses("preview");
        this.removeBusFromAllAddresses("program");
        let cutBusMode = this.source.data.cut_bus_mode;
    
        if (cutBusMode === 'on') {
            for (const address of allPreviews) {
                if (allPrograms.has(address)) {
                    this.addBusToAddress(address.toString(), "program");
                } else {
                    this.addBusToAddress(address.toString(), "preview");
                }
            }
        } else {
            for (const address of allPrograms) {
                this.addBusToAddress(address.toString(), "program");
            }
            for (const address of allPreviews) {
                this.addBusToAddress(address.toString(), "preview");
            }
        }
        this.sendTallyData();
    }

    public exit(): void {
        super.exit();
        this.atemClient.disconnect();
    }
}
