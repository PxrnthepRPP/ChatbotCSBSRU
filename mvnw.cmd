@echo off
@REM ----------------------------------------------------------------------------
@REM Maven Wrapper for Windows (BSRU Student Portal)
@REM ----------------------------------------------------------------------------

if not defined JAVA_HOME (
    if exist "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot" (
        set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
    )
)

if exist "C:\Users\beria\apache-maven-3.9.9\bin\mvn.cmd" (
    "C:\Users\beria\apache-maven-3.9.9\bin\mvn.cmd" %*
) else (
    mvn %*
)
