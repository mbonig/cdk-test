 docker run -it --rm -v "${pwd}:/cdk-test" -v ~/.aws:/home/mbonig/.aws -u mbonig cdk-test bash -l
