"""GitHub Actionsへ非機密の翻訳設定だけを渡す。"""

import os
from pathlib import Path

from provider_factory import describe_provider


def main() -> None:
    """検証済みの固定キーをActionsの出力ファイルへ書く。"""
    descriptor = describe_provider()
    values = {
        "provider": descriptor["provider"],
        "aws-enabled": str(
            descriptor["configured"] and descriptor["provider"] != "argos"
        ).lower(),
        "aws-region": descriptor["awsRegion"],
        "aws-role-arn": descriptor["awsRoleArn"],
    }
    with Path(os.environ["GITHUB_OUTPUT"]).open("a") as output:
        output.writelines(f"{key}={value}\n" for key, value in values.items())


if __name__ == "__main__":
    main()
