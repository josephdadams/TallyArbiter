import { device_sources, logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { FreePort, UsePort } from '../_decorators/UsesPort.decorator'
import { Source } from '../_models/Source'
import { TallyInputConfigField } from '../_types/TallyInputConfigField'
import { TallyInput } from './_Source'
import TSLUMD from 'tsl-umd'
import packet from 'packet'
import net from 'net'

const RossCarboniteFields: TallyInputConfigField[] = [
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{
		fieldName: 'transport_type',
		fieldLabel: 'Transport Type',
		fieldType: 'dropdown',
		options: [
			{ id: 'udp', label: 'UDP' },
			{ id: 'tcp', label: 'TCP' },
		],
	},
]

const RossCarboniteBusAdresses = [
	{ address: 'onair_program', bus: 'onair', label: 'OnAir Program', type: 'program' },
	{ address: 'onair_preview', bus: 'onair', label: 'OnAir Preview', type: 'preview' },
	{ address: '25', bus: 'me1', label: 'ME 1 BKGD', type: 'program' },
	{ address: '26', bus: 'me1', label: 'ME 1 PST', type: 'preview' },
	{ address: '35', bus: 'me2', label: 'ME 2 BKGD', type: 'program' },
	{ address: '36', bus: 'me2', label: 'ME 2 PST', type: 'preview' },
	{ address: '45', bus: 'me3', label: 'ME 3 BKGD', type: 'program' },
	{ address: '46', bus: 'me3', label: 'ME 3 PST', type: 'preview' },
	{ address: '65', bus: 'aux1', label: 'Aux 1', type: 'program' },
	{ address: '66', bus: 'aux2', label: 'Aux 2', type: 'program' },
	{ address: '67', bus: 'aux3', label: 'Aux 3', type: 'program' },
	{ address: '68', bus: 'aux4', label: 'Aux 4', type: 'program' },
	{ address: '69', bus: 'aux5', label: 'Aux 5', type: 'program' },
	{ address: '70', bus: 'aux6', label: 'Aux 6', type: 'program' },
	{ address: '71', bus: 'aux7', label: 'Aux 7', type: 'program' },
	{ address: '72', bus: 'aux8', label: 'Aux 8', type: 'program' },
	{ address: '81', bus: 'mme1', label: 'MiniME™ 1 BKGD', type: 'program' },
	{ address: '82', bus: 'mme1', label: 'MiniME™ 1 PST', type: 'preview' },
	{ address: '86', bus: 'mme2', label: 'MiniME™ 2 BKGD', type: 'program' },
	{ address: '87', bus: 'mme2', label: 'MiniME™ 2 PST', type: 'preview' },
	{ address: '91', bus: 'mme3', label: 'MiniME™ 3 BKGD', type: 'program' },
	{ address: '92', bus: 'mme3', label: 'MiniME™ 3 PST', type: 'preview' },
	{ address: '96', bus: 'mme4', label: 'MiniME™ 4 BKGD', type: 'program' },
	{ address: '97', bus: 'mme4', label: 'MiniME™ 4 PST', type: 'preview' },
]
const RossCarboniteBlackSoloBusAddresses = [
	{ address: 'onair_program', bus: 'onair', label: 'OnAir Program', type: 'program' },
	{ address: 'onair_preview', bus: 'onair', label: 'OnAir Preview', type: 'preview' },
	{ address: '37', bus: 'me1', label: 'ME 1 BKGD', type: 'program' },
	{ address: '38', bus: 'me1', label: 'ME 1 PST', type: 'preview' },
	{ address: '67', bus: 'aux1', label: 'Aux 1', type: 'program' },
	{ address: '68', bus: 'aux2', label: 'Aux 2', type: 'program' },
	{ address: '69', bus: 'aux3', label: 'Aux 3', type: 'program' },
	{ address: '70', bus: 'aux4', label: 'Aux 4', type: 'program' },
	{ address: '71', bus: 'aux5', label: 'Aux 5', type: 'program' },
	{ address: '72', bus: 'aux6', label: 'Aux 6', type: 'program' },
	{ address: '73', bus: 'aux7', label: 'Aux 7', type: 'program' },
	{ address: '74', bus: 'aux8', label: 'Aux 8', type: 'program' },
	{ address: '75', bus: 'aux9', label: 'Aux 9', type: 'program' },
	{ address: '76', bus: 'aux10', label: 'Aux 10', type: 'program' },
	{ address: '77', bus: 'aux11', label: 'Aux 11', type: 'program' },
	{ address: '78', bus: 'aux12', label: 'Aux 12', type: 'program' },
	{ address: '79', bus: 'aux13', label: 'Aux 13', type: 'program' },
	{ address: '80', bus: 'aux14', label: 'Aux 14', type: 'program' },
	{ address: '81', bus: 'aux15', label: 'Aux 15', type: 'program' },
	{ address: '82', bus: 'aux16', label: 'Aux 16', type: 'program' },
]
const RossGraphiteBusAddresses = [
	{ address: 'onair_program', bus: 'onair', label: 'OnAir Program', type: 'program' },
	{ address: 'onair_preview', bus: 'onair', label: 'OnAir Preview', type: 'preview' },
	{ address: '37', bus: 'me1', label: 'ME 1 BKGD', type: 'program' },
	{ address: '38', bus: 'me1', label: 'ME 1 PST', type: 'preview' },
	{ address: '47', bus: 'me2', label: 'ME 2 BKGD', type: 'program' },
	{ address: '48', bus: 'me2', label: 'ME 2 PST', type: 'preview' },
	{ address: '67', bus: 'aux1', label: 'Aux 1', type: 'program' },
	{ address: '68', bus: 'aux2', label: 'Aux 2', type: 'program' },
	{ address: '69', bus: 'aux3', label: 'Aux 3', type: 'program' },
	{ address: '70', bus: 'aux4', label: 'Aux 4', type: 'program' },
	{ address: '71', bus: 'aux5', label: 'Aux 5', type: 'program' },
	{ address: '72', bus: 'aux6', label: 'Aux 6', type: 'program' },
	{ address: '73', bus: 'aux7', label: 'Aux 7', type: 'program' },
	{ address: '74', bus: 'aux8', label: 'Aux 8', type: 'program' },
	{ address: '75', bus: 'aux9', label: 'Aux 9', type: 'program' },
	{ address: '76', bus: 'aux10', label: 'Aux 10', type: 'program' },
	{ address: '77', bus: 'aux11', label: 'Aux 11', type: 'program' },
	{ address: '78', bus: 'aux12', label: 'Aux 12', type: 'program' },
	{ address: '79', bus: 'aux13', label: 'Aux 13', type: 'program' },
	{ address: '80', bus: 'aux14', label: 'Aux 14', type: 'program' },
	{ address: '81', bus: 'aux15', label: 'Aux 15', type: 'program' },
	{ address: '82', bus: 'aux16', label: 'Aux 16', type: 'program' },
	{ address: '83', bus: 'aux17', label: 'Aux 17', type: 'program' },
	{ address: '84', bus: 'aux18', label: 'Aux 18', type: 'program' },
	{ address: '85', bus: 'aux19', label: 'Aux 19', type: 'program' },
	{ address: '86', bus: 'aux20', label: 'Aux 20', type: 'program' },
	{ address: '87', bus: 'mme1', label: 'MiniME™ 1 BKGD', type: 'program' },
	{ address: '98', bus: 'mme1', label: 'MiniME™ 1 PST', type: 'preview' },
	{ address: '91', bus: 'mme2', label: 'MiniME™ 2 BKGD', type: 'program' },
	{ address: '92', bus: 'mme2', label: 'MiniME™ 2 PST', type: 'preview' },
	{ address: '95', bus: 'mme3', label: 'MiniME™ 3 BKGD', type: 'program' },
	{ address: '96', bus: 'mme3', label: 'MiniME™ 3 PST', type: 'preview' },
	{ address: '105', bus: 'mme4', label: 'MiniME™ 4 BKGD', type: 'program' },
	{ address: '106', bus: 'mme4', label: 'MiniME™ 4 PST', type: 'preview' },
]
const RossCarboniteBlackSoloSDHDBusAddresses = [
	{ address: 'onair_program', bus: 'onair', label: 'OnAir Program', type: 'program' },
	{ address: 'onair_preview', bus: 'onair', label: 'OnAir Preview', type: 'preview' },
	{ address: '37', bus: 'me1', label: 'ME 1 BKGD', type: 'program' },
	{ address: '38', bus: 'me1', label: 'ME 1 PST', type: 'preview' },
	{ address: '47', bus: 'me2', label: 'ME 2 BKGD', type: 'program' },
	{ address: '48', bus: 'me2', label: 'ME 2 PST', type: 'preview' },
	{ address: '57', bus: 'me3', label: 'ME 3 BKGD', type: 'program' },
	{ address: '58', bus: 'me3', label: 'ME 3 PST', type: 'preview' },
	{ address: '67', bus: 'aux1', label: 'Aux 1', type: 'program' },
	{ address: '68', bus: 'aux2', label: 'Aux 2', type: 'program' },
	{ address: '69', bus: 'aux3', label: 'Aux 3', type: 'program' },
	{ address: '70', bus: 'aux4', label: 'Aux 4', type: 'program' },
	{ address: '71', bus: 'aux5', label: 'Aux 5', type: 'program' },
	{ address: '72', bus: 'aux6', label: 'Aux 6', type: 'program' },
	{ address: '73', bus: 'aux7', label: 'Aux 7', type: 'program' },
	{ address: '74', bus: 'aux8', label: 'Aux 8', type: 'program' },
	{ address: '75', bus: 'aux9', label: 'Aux 9', type: 'program' },
	{ address: '76', bus: 'aux10', label: 'Aux 10', type: 'program' },
	{ address: '77', bus: 'aux11', label: 'Aux 11', type: 'program' },
	{ address: '78', bus: 'aux12', label: 'Aux 12', type: 'program' },
	{ address: '79', bus: 'aux13', label: 'Aux 13', type: 'program' },
	{ address: '80', bus: 'aux14', label: 'Aux 14', type: 'program' },
	{ address: '81', bus: 'aux15', label: 'Aux 15', type: 'program' },
	{ address: '82', bus: 'aux16', label: 'Aux 16', type: 'program' },
	{ address: '83', bus: 'aux17', label: 'Aux 17', type: 'program' },
	{ address: '84', bus: 'aux18', label: 'Aux 18', type: 'program' },
	{ address: '85', bus: 'aux19', label: 'Aux 19', type: 'program' },
	{ address: '86', bus: 'aux20', label: 'Aux 20', type: 'program' },
	{ address: '87', bus: 'mme1', label: 'MiniME™ 1 BKGD', type: 'program' },
	{ address: '88', bus: 'mme1', label: 'MiniME™ 1 PST', type: 'preview' },
	{ address: '91', bus: 'mme2', label: 'MiniME™ 2 BKGD', type: 'program' },
	{ address: '92', bus: 'mme2', label: 'MiniME™ 2 PST', type: 'preview' },
	{ address: '95', bus: 'mme3', label: 'MiniME™ 3 BKGD', type: 'program' },
	{ address: '96', bus: 'mme3', label: 'MiniME™ 3 PST', type: 'preview' },
	{ address: '105', bus: 'mme4', label: 'MiniME™ 4 BKGD', type: 'program' },
	{ address: '106', bus: 'mme4', label: 'MiniME™ 4 PST', type: 'preview' },
]
const RossCarboniteUltraBusAddresses = [
	{ address: 'onair_program', bus: 'onair', label: 'OnAir Program', type: 'program' },
	{ address: 'onair_preview', bus: 'onair', label: 'OnAir Preview', type: 'preview' },
	{ address: '25', bus: 'mepp', label: 'ME P/P BKGD', type: 'program' },
	{ address: '26', bus: 'mepp', label: 'ME P/P PST', type: 'preview' },
	{ address: '35', bus: 'me1', label: 'ME 1 BKGD', type: 'program' },
	{ address: '36', bus: 'me1', label: 'ME 1 PST', type: 'preview' },
	{ address: '45', bus: 'me2', label: 'ME 2 BKGD', type: 'program' },
	{ address: '46', bus: 'me2', label: 'ME 2 PST', type: 'preview' },
	{ address: '64', bus: 'mme1', label: 'MiniME™ 1 BKGD', type: 'program' },
	{ address: '65', bus: 'mme1', label: 'MiniME™ 1 PST', type: 'preview' },
	{ address: '68', bus: 'mme2', label: 'MiniME™ 2 BKGD', type: 'program' },
	{ address: '69', bus: 'mme2', label: 'MiniME™ 2 PST', type: 'preview' },
	{ address: '72', bus: 'mme3', label: 'MiniME™ 3 BKGD', type: 'program' },
	{ address: '73', bus: 'mme3', label: 'MiniME™ 3 PST', type: 'preview' },
	{ address: '76', bus: 'mme4', label: 'MiniME™ 4 BKGD', type: 'program' },
	{ address: '77', bus: 'mme4', label: 'MiniME™ 4 PST', type: 'preview' },
	{ address: '100', bus: 'aux1', label: 'Aux 1', type: 'program' },
	{ address: '101', bus: 'aux2', label: 'Aux 2', type: 'program' },
	{ address: '102', bus: 'aux3', label: 'Aux 3', type: 'program' },
	{ address: '103', bus: 'aux4', label: 'Aux 4', type: 'program' },
	{ address: '104', bus: 'aux5', label: 'Aux 5', type: 'program' },
	{ address: '105', bus: 'aux6', label: 'Aux 6', type: 'program' },
	{ address: '106', bus: 'aux7', label: 'Aux 7', type: 'program' },
	{ address: '107', bus: 'aux8', label: 'Aux 8', type: 'program' },
	{ address: '108', bus: 'aux9', label: 'Aux 9', type: 'program' },
	{ address: '109', bus: 'aux10', label: 'Aux 10', type: 'program' },
	{ address: '110', bus: 'aux11', label: 'Aux 11', type: 'program' },
	{ address: '111', bus: 'aux12', label: 'Aux 12', type: 'program' },
	{ address: '112', bus: 'aux13', label: 'Aux 13', type: 'program' },
	{ address: '113', bus: 'aux14', label: 'Aux 14', type: 'program' },
	{ address: '114', bus: 'aux15', label: 'Aux 15', type: 'program' },
	{ address: '115', bus: 'aux16', label: 'Aux 16', type: 'program' },
	{ address: '116', bus: 'aux17', label: 'Aux 17', type: 'program' },
	{ address: '117', bus: 'aux18', label: 'Aux 18', type: 'program' },
	{ address: '118', bus: 'aux19', label: 'Aux 19', type: 'program' },
	{ address: '119', bus: 'aux20', label: 'Aux 20', type: 'program' },
	{ address: '120', bus: 'aux21', label: 'Aux 21', type: 'program' },
	{ address: '121', bus: 'aux22', label: 'Aux 22', type: 'program' },
	{ address: '122', bus: 'aux23', label: 'Aux 23', type: 'program' },
	{ address: '123', bus: 'aux24', label: 'Aux 24', type: 'program' },
	{ address: '124', bus: 'aux25', label: 'Aux 25', type: 'program' },
	{ address: '125', bus: 'aux26', label: 'Aux 26', type: 'program' },
	{ address: '126', bus: 'aux27', label: 'Aux 27', type: 'program' },
]

const RossSwitcherBusAddresses = {
	'039bb9d6': RossCarboniteBusAdresses,
	e1c46de9: RossCarboniteBlackSoloBusAddresses,
	'63d7ebc6': RossGraphiteBusAddresses,
	'22d507ab': RossCarboniteBlackSoloSDHDBusAddresses,
	'7da3b524': RossCarboniteUltraBusAddresses,
}

@RegisterTallyInput('039bb9d6', 'Ross Carbonite', '', RossCarboniteFields, [
	{ bus: 'onair', name: 'Follow OnAir Setting' },
	{ bus: 'me1', name: 'ME 1' },
	{ bus: 'me2', name: 'ME 2' },
	{ bus: 'me3', name: 'ME 3' },
	{ bus: 'mme1', name: 'MiniME 1' },
	{ bus: 'mme2', name: 'MiniME 2' },
	{ bus: 'mme3', name: 'MiniME 3' },
	{ bus: 'mme4', name: 'MiniME 4' },
	{ bus: 'aux1', name: 'Aux 1' },
	{ bus: 'aux2', name: 'Aux 2' },
	{ bus: 'aux3', name: 'Aux 3' },
	{ bus: 'aux4', name: 'Aux 4' },
	{ bus: 'aux5', name: 'Aux 5' },
	{ bus: 'aux6', name: 'Aux 6' },
	{ bus: 'aux7', name: 'Aux 7' },
	{ bus: 'aux8', name: 'Aux 8' },
])
@RegisterTallyInput('e1c46de9', 'Ross Carbonite Black Solo', '', RossCarboniteFields, [
	{ bus: 'onair', name: 'Follow OnAir Setting' },
	{ bus: 'me1', name: 'ME 1' },
	{ bus: 'aux1', name: 'Aux 1' },
	{ bus: 'aux2', name: 'Aux 2' },
	{ bus: 'aux3', name: 'Aux 3' },
	{ bus: 'aux4', name: 'Aux 4' },
	{ bus: 'aux5', name: 'Aux 5' },
	{ bus: 'aux6', name: 'Aux 6' },
	{ bus: 'aux7', name: 'Aux 7' },
	{ bus: 'aux8', name: 'Aux 8' },
	{ bus: 'aux9', name: 'Aux 9' },
	{ bus: 'au10', name: 'Aux 10' },
	{ bus: 'aux11', name: 'Aux 11' },
	{ bus: 'aux12', name: 'Aux 12' },
	{ bus: 'aux13', name: 'Aux 13' },
	{ bus: 'aux14', name: 'Aux 14' },
	{ bus: 'aux15', name: 'Aux 15' },
	{ bus: 'aux16', name: 'Aux 16' },
])
@RegisterTallyInput('63d7ebc6', 'Ross Graphite', '', RossCarboniteFields, [
	{ bus: 'onair', name: 'Follow OnAir Setting' },
	{ bus: 'me1', name: 'ME 1' },
	{ bus: 'me2', name: 'ME 2' },
	{ bus: 'mme1', name: 'MiniME 1' },
	{ bus: 'mme2', name: 'MiniME 2' },
	{ bus: 'mme3', name: 'MiniME 3' },
	{ bus: 'mme4', name: 'MiniME 4' },
	{ bus: 'aux1', name: 'Aux 1' },
	{ bus: 'aux2', name: 'Aux 2' },
	{ bus: 'aux3', name: 'Aux 3' },
	{ bus: 'aux4', name: 'Aux 4' },
	{ bus: 'aux5', name: 'Aux 5' },
	{ bus: 'aux6', name: 'Aux 6' },
	{ bus: 'aux7', name: 'Aux 7' },
	{ bus: 'aux8', name: 'Aux 8' },
	{ bus: 'aux9', name: 'Aux 9' },
	{ bus: 'au10', name: 'Aux 10' },
	{ bus: 'aux11', name: 'Aux 11' },
	{ bus: 'aux12', name: 'Aux 12' },
	{ bus: 'aux13', name: 'Aux 13' },
	{ bus: 'aux14', name: 'Aux 14' },
	{ bus: 'aux15', name: 'Aux 15' },
	{ bus: 'aux16', name: 'Aux 16' },
	{ bus: 'aux17', name: 'Aux 17' },
	{ bus: 'aux18', name: 'Aux 18' },
	{ bus: 'aux19', name: 'Aux 19' },
	{ bus: 'aux20', name: 'Aux 20' },
])
@RegisterTallyInput('22d507ab', 'Ross Carbonite Black SD/HD', '', RossCarboniteFields, [
	{ bus: 'onair', name: 'Follow OnAir Setting' },
	{ bus: 'me1', name: 'ME 1' },
	{ bus: 'me2', name: 'ME 2' },
	{ bus: 'me3', name: 'ME 3' },
	{ bus: 'mme1', name: 'MiniME 1' },
	{ bus: 'mme2', name: 'MiniME 2' },
	{ bus: 'mme3', name: 'MiniME 3' },
	{ bus: 'mme4', name: 'MiniME 4' },
	{ bus: 'aux1', name: 'Aux 1' },
	{ bus: 'aux2', name: 'Aux 2' },
	{ bus: 'aux3', name: 'Aux 3' },
	{ bus: 'aux4', name: 'Aux 4' },
	{ bus: 'aux5', name: 'Aux 5' },
	{ bus: 'aux6', name: 'Aux 6' },
	{ bus: 'aux7', name: 'Aux 7' },
	{ bus: 'aux8', name: 'Aux 8' },
	{ bus: 'aux9', name: 'Aux 9' },
	{ bus: 'au10', name: 'Aux 10' },
	{ bus: 'aux11', name: 'Aux 11' },
	{ bus: 'aux12', name: 'Aux 12' },
	{ bus: 'aux13', name: 'Aux 13' },
	{ bus: 'aux14', name: 'Aux 14' },
	{ bus: 'aux15', name: 'Aux 15' },
	{ bus: 'aux16', name: 'Aux 16' },
	{ bus: 'aux17', name: 'Aux 17' },
	{ bus: 'aux18', name: 'Aux 18' },
	{ bus: 'aux19', name: 'Aux 19' },
	{ bus: 'aux20', name: 'Aux 20' },
])
@RegisterTallyInput('7da3b524', 'Ross Carbonite Ultra', '', RossCarboniteFields, [
	{ bus: 'onair', name: 'Follow OnAir Setting' },
	{ bus: 'mepp', name: 'ME P/P' },
	{ bus: 'me1', name: 'ME 1' },
	{ bus: 'me2', name: 'ME 2' },
	{ bus: 'mme1', name: 'MiniME 1' },
	{ bus: 'mme2', name: 'MiniME 2' },
	{ bus: 'mme3', name: 'MiniME 3' },
	{ bus: 'mme4', name: 'MiniME 4' },
	{ bus: 'aux1', name: 'Aux 1' },
	{ bus: 'aux2', name: 'Aux 2' },
	{ bus: 'aux3', name: 'Aux 3' },
	{ bus: 'aux4', name: 'Aux 4' },
	{ bus: 'aux5', name: 'Aux 5' },
	{ bus: 'aux6', name: 'Aux 6' },
	{ bus: 'aux7', name: 'Aux 7' },
	{ bus: 'aux8', name: 'Aux 8' },
	{ bus: 'aux9', name: 'Aux 9' },
	{ bus: 'au10', name: 'Aux 10' },
	{ bus: 'aux11', name: 'Aux 11' },
	{ bus: 'aux12', name: 'Aux 12' },
	{ bus: 'aux13', name: 'Aux 13' },
	{ bus: 'aux14', name: 'Aux 14' },
	{ bus: 'aux15', name: 'Aux 15' },
	{ bus: 'aux16', name: 'Aux 16' },
	{ bus: 'aux17', name: 'Aux 17' },
	{ bus: 'aux18', name: 'Aux 18' },
	{ bus: 'aux19', name: 'Aux 19' },
	{ bus: 'aux20', name: 'Aux 20' },
	{ bus: 'aux21', name: 'Aux 21' },
	{ bus: 'aux22', name: 'Aux 22' },
	{ bus: 'aux23', name: 'Aux 23' },
	{ bus: 'aux24', name: 'Aux 24' },
	{ bus: 'aux25', name: 'Aux 25' },
	{ bus: 'aux26', name: 'Aux 26' },
	{ bus: 'aux27', name: 'Aux 27' },
])
export class RossCarboniteSource extends TallyInput {
	private server: any
	private tallydata_RossCarbonite = []
	constructor(source: Source) {
		super(source)
		let port = source.data.port
		let transport = source.data.transport_type

		if (transport === 'udp') {
			UsePort(port, this.source.id)
			this.server = new TSLUMD(port)

			this.server.on('message', (tally) => {
				this.processRossCarboniteTally(tally)
			})

			this.connected.next(true)
		} else {
			let parser = packet.createParser()
			parser.packet(
				'tsl',
				'b8{x1, b7 => address},b8{x2, b2 => brightness, b1 => tally4, b1 => tally3, b1 => tally2, b1 => tally1 }, b8[16] => label',
			)

			UsePort(port, this.source.id)
			this.server = net
				.createServer((socket) => {
					socket.on('data', (data) => {
						parser.extract('tsl', (result) => {
							result.label = Buffer.from(result.label).toString()
							this.processRossCarboniteTally(result)
						})
						parser.parse(data)
					})

					socket.on('close', () => {
						this.connected.next(false)
					})
				})
				.listen(port, () => {
					this.connected.next(true)
				})
		}
	}

	private processRossCarboniteTally(tallyObj) {
		let labelAddress = parseInt(tallyObj.label.substring(0, tallyObj.label.indexOf(':'))) as any

		if (!isNaN(labelAddress)) {
			//if it's a number, then the address in the label field is the "real" tally address we care about
			labelAddress = labelAddress.toString() //convert it to a string since all other addresses are stored as strings
			this.addRossCarboniteTally(tallyObj.address.toString(), labelAddress)
		} else {
			//if it's not a number, then process the normal tally address
			for (let i = 0; i < device_sources.length; i++) {
				if (device_sources[i].sourceId === this.source.id) {
					//this device_source is associated with the tally data of this source
					if (device_sources[i].address === tallyObj.address.toString()) {
						//this device_source's address matches what was in the address field
						if (device_sources[i].bus === 'onair') {
							if (tallyObj.tally1) {
								this.addRossCarboniteTally('onair_preview', tallyObj.address.toString())
							} else {
								this.removeRossCarboniteTally('onair_preview', tallyObj.address.toString())
							}
							if (tallyObj.tally2) {
								this.addRossCarboniteTally('onair_program', tallyObj.address.toString())
							} else {
								this.removeRossCarboniteTally('onair_program', tallyObj.address.toString())
							}
						}
					}
				}
			}
		}
	}

	private addRossCarboniteTally(busAddress, address) {
		let found = false

		for (let i = 0; i < this.tallydata_RossCarbonite.length; i++) {
			if (this.tallydata_RossCarbonite[i].address === address) {
				found = true
				if (!this.tallydata_RossCarbonite[i].busses.includes(busAddress)) {
					this.tallydata_RossCarbonite[i].busses.push(busAddress) //add the bus address to this item
					this.updateRossCarboniteTallyData(this.tallydata_RossCarbonite[i].address)
				}
			} else {
				if (this.tallydata_RossCarbonite[i].busses.includes(busAddress)) {
					//remove this bus from this entry, as it is no longer in it (the label field can only hold one entry at a time)
					if (busAddress !== 'onair_preview' && busAddress !== 'onair_program') {
						this.removeRossCarboniteTally(busAddress, this.tallydata_RossCarbonite[i].address)
					}
				}
			}
		}

		if (!found) {
			//if there was not an entry in the array for this address
			let tallyObj = {
				busses: [busAddress],
				address,
			}
			this.tallydata_RossCarbonite.push(tallyObj)
		}
	}

	private removeRossCarboniteTally(busAddress, address) {
		for (let i = 0; i < this.tallydata_RossCarbonite.length; i++) {
			if (this.tallydata_RossCarbonite[i].address === address) {
				this.tallydata_RossCarbonite[i].busses = this.tallydata_RossCarbonite[i].busses.filter(
					(bus) => bus !== busAddress,
				)
				this.updateRossCarboniteTallyData(this.tallydata_RossCarbonite[i].address)
			}
		}
	}

	private updateRossCarboniteTallyData(address) {
		//build a new TSL tally obj based on this address and whatever busses it might be in
		let inPreview = false
		let inProgram = false

		let found = false

		for (let i = 0; i < device_sources.length; i++) {
			inPreview = false
			inProgram = false
			if (device_sources[i].address === address) {
				//this device_source has this address in it, so let's loop through the tallydata_carbonite array
				//   and find all the busses that match this address
				let busses = this.tallydata_RossCarbonite.find(({ address }) => address === device_sources[i].address).busses

				for (let j = 0; j < busses.length; j++) {
					let bus = RossCarboniteBusAdresses[this.source.sourceTypeId].find(
						(busAddress) => busAddress.address === busses[j],
					)
					if (bus) {
						//if bus is undefined, it's not a bus we monitor anyways
						if (bus.bus === device_sources[i].bus) {
							if (bus.type === 'preview') {
								inPreview = true
							} else if (bus.type === 'program') {
								inProgram = true
							}
						}
					}
				}

				const b = []
				if (inPreview) {
					b.push('preview')
				}
				if (inProgram) {
					b.push('program')
				}
				this.setBussesForAddress(address, b)
			}
		}
		this.sendTallyData()
	}

	public exit(): void {
		super.exit()
		const transport = this.source.data.transport_type
		if (transport === 'udp') {
			this.server.server.close()
		} else {
			this.server.close(() => {})
		}
		FreePort(this.source.data.port, this.source.id)
		this.connected.next(false)
	}
}
