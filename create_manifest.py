import json
import os
import requests

def main():
    # Gather inputs from user
    manifest_raw = input("Enter ESP Web Tools manifest raw URL: ").strip()
    manifest_downloads_append = input("Enter append URL for downloads: ").strip()
    chip = input("Enter ESP32 chip model: ").strip()
    firmware_name = input("Enter firmware name: ").strip()
    firmware_version = input("Enter firmware version: ").strip()
    firmware_author = input("Enter firmware author: ").strip()


    firmware_name_manifest = f"{firmware_name} ({chip})"


    # Define manifest structure
    manifest = {
        "name": firmware_name_manifest,
        "version": firmware_version,
        "author": firmware_author,
        "device": chip,
        "manifest": f"manifests/{chip}/{firmware_name}/{firmware_name_manifest}.json"
    }

    # Update firmware.json file
    firmware_json_path = "firmware.json"
    try:
        # If firmware.json doesn't exist, start with an empty list
        if not os.path.exists(firmware_json_path):
            data = []
        else:
            with open(firmware_json_path, "r+") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    data = []

        data.append(manifest)
        with open(firmware_json_path, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Failed to update {firmware_json_path}: {e}")
        return

    # Create necessary directories
    manifests_dir = os.path.join("manifests", chip, firmware_name)
    try:
        os.makedirs(manifests_dir, exist_ok=True)
    except Exception as e:
        print(f"Failed to create directories: {e}")
        return

    # Download and update the manifest content
    try:
        r = requests.get(manifest_raw)
        if r.status_code == 200:
            downloaded_manifest = r.json()

            # Update each part's "path"
            for build in downloaded_manifest.get("builds", []):
                for part in build.get("parts", []):
                    part["path"] = manifest_downloads_append + part["path"]

            # Save the updated manifest to file
            target_manifest_path = os.path.join(manifests_dir, f"{firmware_name_manifest}.json")
            with open(target_manifest_path, "w") as f:
                json.dump(downloaded_manifest, f, indent=4)
            print("Manifest created successfully.")
        else:
            print("Failed to download manifest from the provided URL.")
    except Exception as e:
        print(f"An error occurred while processing the manifest: {e}")

if __name__ == "__main__":
    main()