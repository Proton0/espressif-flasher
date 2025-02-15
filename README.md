# espressif-flasher

literally google for flashing espressif chips


# how to add firmware

## firmware.json

Just add the following entry to firmware.json then make a pull request

```json
{
    "name": "Firmware Name",
    "version": "Firmware Version",
    "author": "Author",
    "manifest": "Manifest",
    "device": "Device"
    },
```

## manifest

Make a folder in `manifest/<espressif chip>/<project name>` then make a any .json

The format is the same as the `ESP Web Tools Framework`, just make sure its an actual path
or add your firmware in the `firmware` folder


# pull request

just please properly explain what you are doing