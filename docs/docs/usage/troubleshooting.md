---
sidebar_position: 3
---

# Troubleshooting

If something does not work, please have a look at the <i>Logs</i> first. You can find them on the <i>Settings</i> page in the <i>Logs</i> tab. Change the loglevel to <i>Verbose</i> in order to see all messages.

If you think that you've found a bug in TallyArbiter or have a new feature request, feel free to [open an Issue in our GitHub Repository](https://github.com/josephdadams/TallyArbiter/issues/new/choose).

## Access the Logs directly (without the UI)

If you cannot reach the logs via the UI, you can view those files manually. The location depends on the platform you're using:

<table>
	<thead>
		<tr>
			<td>Platform</td>
			<td>Logs</td>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>Windows</td>
			<td><b><code>%APPDATA%\TallyArbiter\logs</code></b><br/><br/>(<code>%APPDATA%</code> is a variable. You can, however, directly copy that in the address bar of Windows Explorer. The whole path will look something like this: <code>C:\Users\USERNAME\AppData\Roaming\TallyArbiter\logs</code>, but you need to replace <code>USERNAME</code> with your username)</td>
		</tr>
		<tr>
			<td>MacOS</td>
			<td><b><code>&#126;/Library/Preferences/TallyArbiter/logs</code></b><br/><br/>(<code>&#126;</code> points to your home directory. The full path will look something like this: <code>/Users/USERNAME/Library/Preferences/TallyArbiter/logs</code>, but you need to replace <code>USERNAME</code> with your username)</td>
		</tr>
		<tr>
			<td>Linux / Raspberry Pi</td>
			<td><b><code>&#126;/.local/share/TallyArbiter/logs</code></b><br/><br/>(<code>&#126;</code> points to your home directory. The full path will look something like this: <code>/Users/USERNAME/.local/share/TallyArbiter/logs</code>, but you need to replace <code>USERNAME</code> with your username)</td>
		</tr>
	</tbody>
</table>
